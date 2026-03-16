import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

describe('3dprint-oracle server', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer({ dbPath: ':memory:' });
    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  it('lists 8 tools', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(8);
    const names = tools.map((t) => t.name);
    expect(names).toContain('search_filaments');
    expect(names).toContain('get_filament');
    expect(names).toContain('list_manufacturers');
    expect(names).toContain('list_materials');
    expect(names).toContain('get_material_profile');
    expect(names).toContain('compare_materials');
    expect(names).toContain('recommend_material');
    expect(names).toContain('diagnose_print_issue');
  });
});
