import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('list_manufacturers', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('returns all manufacturers with counts', async () => {
    const result = await client.callTool({
      name: 'list_manufacturers',
      arguments: {},
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Bambu Lab');
    expect(text).toContain('Prusament');
    expect(text).not.toContain('Not implemented');
    // Total count
    expect(text).toContain('2');
  });

  it('shows accurate filament counts', async () => {
    const result = await client.callTool({
      name: 'list_manufacturers',
      arguments: {},
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    // Bambu Lab has 4 filaments, Prusament has 3
    expect(text).toContain('4');
    expect(text).toContain('3');
  });

  it('filters by material type', async () => {
    const result = await client.callTool({
      name: 'list_manufacturers',
      arguments: { material: 'ABS' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    // Only Prusament has ABS
    expect(text).toContain('Prusament');
    expect(text).not.toContain('Bambu Lab');
  });

  it('material filter narrows counts', async () => {
    const result = await client.callTool({
      name: 'list_manufacturers',
      arguments: { material: 'PLA' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    // Both manufacturers have PLA
    expect(text).toContain('Bambu Lab');
    expect(text).toContain('Prusament');
  });
});
