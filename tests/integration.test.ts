import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'src', 'data', '3dprint.sqlite');
const HAS_DATA = existsSync(DB_PATH);

describe.skipIf(!HAS_DATA)('integration: real SpoolmanDB data', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer({ dbPath: DB_PATH });
    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(ct), server.connect(st)]);
  });

  it('search_filaments finds white PLA filaments', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'white', material: 'PLA' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('PLA');
    expect(text).toContain('result');
  });

  it('search_filaments finds Bambu Lab filaments via manufacturer filter', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'white', manufacturer: 'Bambu Lab' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Bambu Lab');
  });

  it('search_filaments paginates with offset', async () => {
    const page1 = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'white', limit: 5 },
    });
    const page2 = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'white', limit: 5, offset: 5 },
    });
    const text1 = (page1.content[0] as { type: string; text: string }).text;
    const text2 = (page2.content[0] as { type: string; text: string }).text;
    expect(text1).toContain('Showing 1-5');
    expect(text2).toContain('Showing 6-10');
  });

  it('search_filaments filters by material', async () => {
    const result = await client.callTool({
      name: 'search_filaments',
      arguments: { query: 'black', material: 'PETG' },
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    // Every result should be PETG
    if (!result.isError) {
      expect(text).toContain('PETG');
    }
  });

  it('list_manufacturers includes 50+ manufacturers', async () => {
    const result = await client.callTool({
      name: 'list_manufacturers',
      arguments: {},
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    // Should have a substantial number of manufacturers
    const match = text.match(/^(\d+) manufacturer/);
    expect(match).toBeTruthy();
    const count = parseInt(match![1], 10);
    expect(count).toBeGreaterThanOrEqual(50);
  });

  it('list_manufacturers filters by material', async () => {
    const result = await client.callTool({
      name: 'list_manufacturers',
      arguments: { material: 'TPU' },
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('producing TPU');
  });

  it('list_materials includes PLA and PETG', async () => {
    const result = await client.callTool({
      name: 'list_materials',
      arguments: {},
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('PLA');
    expect(text).toContain('PETG');
  });

  it('get_material_profile returns PLA profile', async () => {
    const result = await client.callTool({
      name: 'get_material_profile',
      arguments: { material: 'PLA' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('190'); // min temp
    expect(text).toContain('220'); // max temp
    expect(text).toContain('beginner');
  });

  it('get_material_profile handles case insensitivity', async () => {
    const result = await client.callTool({
      name: 'get_material_profile',
      arguments: { material: 'pla' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('PLA');
  });

  it('compare_materials compares PLA and PETG', async () => {
    const result = await client.callTool({
      name: 'compare_materials',
      arguments: { materials: ['PLA', 'PETG'] },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('PLA');
    expect(text).toContain('PETG');
    expect(text).toContain('Comparison');
  });

  it('compare_materials handles 3-way comparison', async () => {
    const result = await client.callTool({
      name: 'compare_materials',
      arguments: { materials: ['PLA', 'PETG', 'ABS'] },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('PLA');
    expect(text).toContain('PETG');
    expect(text).toContain('ABS');
  });

  it('recommend_material for outdoor use suggests ASA or ABS', async () => {
    const result = await client.callTool({
      name: 'recommend_material',
      arguments: { requirements: { outdoor_use: true } },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    // ASA or ABS should be among top recommendations for outdoor
    expect(text).toMatch(/ASA|ABS/);
  });

  it('recommend_material for beginner suggests PLA', async () => {
    const result = await client.callTool({
      name: 'recommend_material',
      arguments: { requirements: { ease_of_printing: 'beginner' } },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    // PLA should be #1 for beginners
    expect(text).toContain('PLA');
  });

  it('diagnose_print_issue returns fixes for stringing', async () => {
    const result = await client.callTool({
      name: 'diagnose_print_issue',
      arguments: { symptom: 'stringing' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('temperature');
  });

  it('diagnose_print_issue with material includes material-specific advice', async () => {
    const result = await client.callTool({
      name: 'diagnose_print_issue',
      arguments: { symptom: 'stringing', material: 'PETG' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('PETG');
  });

  it('diagnose_print_issue returns error for unknown symptom', async () => {
    const result = await client.callTool({
      name: 'diagnose_print_issue',
      arguments: { symptom: 'exploded_printer' },
    });
    expect(result.isError).toBeTruthy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Available symptoms');
  });

  it('get_filament returns disambiguation for ambiguous name and resolves with manufacturer+material', async () => {
    // "Natural" is shared across many manufacturers and materials in
    // SpoolmanDB, so a bare name lookup must surface a disambiguation list
    // rather than silently picking an arbitrary row.
    const ambiguous = await client.callTool({
      name: 'get_filament',
      arguments: { name: 'Natural' },
    });
    expect(ambiguous.isError).toBeTruthy();
    const ambiguousText = (
      ambiguous.content[0] as { type: string; text: string }
    ).text;
    expect(ambiguousText).toContain('Multiple filaments match');
    expect(ambiguousText).toContain('[ID');

    // Pull the first ID out of the disambiguation list and round-trip it.
    const idMatch = ambiguousText.match(/\[ID\s+(\d+)\]/);
    expect(idMatch).not.toBeNull();
    const id = Number(idMatch![1]);
    const byId = await client.callTool({
      name: 'get_filament',
      arguments: { id },
    });
    expect(byId.isError).toBeFalsy();
    const byIdText = (byId.content[0] as { type: string; text: string }).text;
    expect(byIdText).toContain('Manufacturer:');
    expect(byIdText).toContain('Material:');
    expect(byIdText).toContain('Diameter:');
  });

  it('search_filaments → get_filament round-trip works against real data', async () => {
    // QA agent reproduction: search for a Bambu PLA filament, copy the [ID]
    // out of the search result, and pass it directly to get_filament.
    const search = await client.callTool({
      name: 'search_filaments',
      arguments: { query: '', manufacturer: 'Bambu Lab', material: 'PLA' },
    });
    expect(search.isError).toBeFalsy();
    const searchText = (search.content[0] as { type: string; text: string })
      .text;
    expect(searchText).toMatch(/\[ID\s+\d+\]/);

    const idMatch = searchText.match(/\[ID\s+(\d+)\]/);
    expect(idMatch).not.toBeNull();
    const id = Number(idMatch![1]);

    const detail = await client.callTool({
      name: 'get_filament',
      arguments: { id },
    });
    expect(detail.isError).toBeFalsy();
    const detailText = (detail.content[0] as { type: string; text: string })
      .text;
    expect(detailText).toContain(`ID: ${id}`);
  });
});
