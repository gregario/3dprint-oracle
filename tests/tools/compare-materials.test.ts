import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('compare_materials', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('compares 2 materials successfully', async () => {
    const result = await client.callTool({
      name: 'compare_materials',
      arguments: { materials: ['PLA', 'PETG'] },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    expect(text).toContain('PLA');
    expect(text).toContain('PETG');
    expect(text).toContain('Strength');
  });

  it('compares 3 materials successfully', async () => {
    const result = await client.callTool({
      name: 'compare_materials',
      arguments: { materials: ['PLA', 'PETG', 'ABS'] },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    expect(text).toContain('PLA');
    expect(text).toContain('PETG');
    expect(text).toContain('ABS');
  });

  it('invalid material returns isError identifying which one', async () => {
    const result = await client.callTool({
      name: 'compare_materials',
      arguments: { materials: ['PLA', 'UNOBTANIUM'] },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('UNOBTANIUM');
  });

  it('includes "when to use" summary', async () => {
    const result = await client.callTool({
      name: 'compare_materials',
      arguments: { materials: ['PLA', 'ABS'] },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('When to use');
  });
});
