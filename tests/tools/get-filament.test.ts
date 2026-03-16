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
});
