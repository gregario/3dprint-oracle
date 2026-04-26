import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('get_filament', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('gets filament by ID', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { id: 1 },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Bambu Lab PLA Basic Red');
    expect(text).not.toContain('Not implemented');
  });

  it('gets filament by ID passed as a numeric string (LLM client coercion)', async () => {
    // Tool description advertises "ID" — many LLM clients serialise numeric
    // arguments as strings ("1" rather than 1). The schema must accept both.
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { id: '1' as unknown as number },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Bambu Lab PLA Basic Red');
    expect(result.isError).not.toBe(true);
  });

  it('rejects non-numeric string IDs cleanly', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { id: 'not-a-number' as unknown as number },
    });
    // Either Zod validation rejects (preferred) or tool returns isError.
    // Both are acceptable; what matters is no silent success.
    if (!result.isError) {
      throw new Error('expected error for non-numeric id');
    }
  });

  it('gets filament by name', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { name: 'Prusament PLA Galaxy Silver' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Prusament PLA Galaxy Silver');
    expect(text).toContain('Prusament');
  });

  it('returns full temperature ranges', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { id: 1 },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    // Should include temp info
    expect(text).toContain('190');
    expect(text).toContain('230');
    expect(text).toContain('60');
  });

  it('returns isError when not found by ID', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { id: 9999 },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('search_filaments');
  });

  it('returns isError when not found by name', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { name: 'Nonexistent Filament XYZ' },
    });
    expect(result.isError).toBe(true);
  });

  it('includes manufacturer, material, color info', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { id: 3 },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Bambu Lab');
    expect(text).toContain('PETG');
    expect(text).toContain('Black');
  });

  it('returns disambiguation list when name matches multiple filaments', async () => {
    // "Jade White" is seeded under both Bambu Lab and Prusament — the lookup
    // must NOT silently return one of them; it must surface a list with IDs.
    const result = await client.callTool({
      name: 'get_filament',
      arguments: { name: 'Jade White' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Multiple filaments match');
    expect(text).toContain('[ID');
    expect(text).toContain('Bambu Lab');
    expect(text).toContain('Prusament');
  });

  it('disambiguates by manufacturer + material when passed alongside name', async () => {
    const result = await client.callTool({
      name: 'get_filament',
      arguments: {
        name: 'Jade White',
        manufacturer: 'Bambu Lab',
        material: 'PLA',
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Bambu Lab');
    expect(text).toContain('Jade White');
  });

  it('parses a search_filaments display label passed in the name field', async () => {
    // Mirrors what an agent would do: copy-paste the line emitted by
    // search_filaments and pass it back to get_filament. The label carries
    // the [ID N] prefix, which makes the lookup unambiguous.
    const search = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'Jade White' },
    });
    const searchText = (search.content as { type: string; text: string }[])[0]
      .text;
    const labelMatch = searchText.match(
      /(\[ID\s+\d+\][^\n]+)/,
    );
    expect(labelMatch).not.toBeNull();
    const label = labelMatch![1].replace(/^- /, '').trim();

    const result = await client.callTool({
      name: 'get_filament',
      arguments: { name: label },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Jade White');
  });

  it('round-trip: name returned by search_filaments resolves via get_filament without modification', async () => {
    // This is the regression test for the fleet-QA finding (2026-04-26):
    // an agent must be able to take a row from search_filaments and feed it
    // straight back into get_filament. With the [ID N] prefix in the search
    // output, the round-trip is exact.
    const search = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '', manufacturer: 'Bambu Lab', material: 'PLA' },
    });
    expect(search.isError).toBeFalsy();
    const searchText = (search.content as { type: string; text: string }[])[0]
      .text;

    // Pull every "- [ID N] ..." line out of the search output and round-trip
    // each one through get_filament.
    const lines = searchText
      .split('\n')
      .filter((l: string) => /^- \[ID\s+\d+\]/.test(l));
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const label = line.replace(/^- /, '').trim();
      const detail = await client.callTool({
        name: 'get_filament',
        arguments: { name: label },
      });
      expect(detail.isError).toBeFalsy();
      const detailText = (
        detail.content as { type: string; text: string }[]
      )[0].text;
      // Detail page must echo back the same ID we asked for.
      const idMatch = label.match(/\[ID\s+(\d+)\]/);
      expect(idMatch).not.toBeNull();
      expect(detailText).toContain(`ID: ${idMatch![1]}`);
    }
  });
});
