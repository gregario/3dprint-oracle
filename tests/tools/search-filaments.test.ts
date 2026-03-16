import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('search_filaments', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('searches by text and matches filaments', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'PLA' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('PLA');
    expect(text).not.toContain('Not implemented');
  });

  it('returns multiple matching results', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'Bambu' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    // Should match all 4 Bambu Lab filaments
    expect(text).toContain('Bambu Lab');
    expect(text).toContain('4');
  });

  it('filters by material type', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '', material: 'PETG' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('PETG');
    expect(text).not.toContain('ABS');
  });

  it('filters by manufacturer', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '', manufacturer: 'Prusament' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Prusament');
    expect(text).not.toContain('Bambu Lab');
  });

  it('filters by diameter', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '', diameter: 2.85 },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('2.85');
    // Only the one 2.85mm filament
    expect(text).toContain('1 result');
  });

  it('paginates with offset and limit', async () => {
    const page1 = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '', limit: 2, offset: 0 },
    });
    const page2 = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '', limit: 2, offset: 2 },
    });
    const text1 = (page1.content as { type: string; text: string }[])[0].text;
    const text2 = (page2.content as { type: string; text: string }[])[0].text;
    // Different results on different pages
    expect(text1).not.toEqual(text2);
    // Both pages should show total count
    expect(text1).toContain('7');
    expect(text2).toContain('7');
  });

  it('returns isError when no results found', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'nonexistent_xyz_filament_999' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('search_filaments');
  });

  it('returns all filaments with empty query', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('7');
  });
});
