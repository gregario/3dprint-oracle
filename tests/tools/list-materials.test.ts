import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('list_materials', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('returns all materials with counts', async () => {
    const result = await client.callTool({
      name: 'list_materials',
      arguments: {},
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('PLA');
    expect(text).toContain('PETG');
    expect(text).toContain('ABS');
    expect(text).not.toContain('Not implemented');
  });

  it('includes accurate filament counts', async () => {
    const result = await client.callTool({
      name: 'list_materials',
      arguments: {},
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    // PLA: 4 filaments, PETG: 2, ABS: 1
    expect(text).toContain('4');
    expect(text).toContain('2');
    expect(text).toContain('1');
  });

  it('shows total material count', async () => {
    const result = await client.callTool({
      name: 'list_materials',
      arguments: {},
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('3');
  });
});
