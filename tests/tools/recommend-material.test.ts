import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('recommend_material', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('simple requirement returns ranked recommendations', async () => {
    const result = await client.callTool({
      name: 'recommend_material',
      arguments: { requirements: { strength: 'high' } },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    // Should contain ranked list
    expect(text).toContain('1.');
  });

  it('food_safe requirement ranks food-safe materials higher', async () => {
    const result = await client.callTool({
      name: 'recommend_material',
      arguments: { requirements: { food_safe: true } },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    // PLA is conditionally food safe — should appear first
    expect(text).toContain('PLA');
    const plaIdx = text.indexOf('PLA');
    const petgIdx = text.indexOf('PETG');
    expect(plaIdx).toBeLessThan(petgIdx);
  });

  it('outdoor_use requirement ranks UV-resistant materials higher', async () => {
    const result = await client.callTool({
      name: 'recommend_material',
      arguments: { requirements: { outdoor_use: true } },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    // PETG and ABS have moderate UV resistance, PLA has poor
    // PLA should be ranked lower
    const plaIdx = text.indexOf('PLA');
    const petgIdx = text.indexOf('PETG');
    expect(petgIdx).toBeLessThan(plaIdx);
  });

  it('no requirements returns isError', async () => {
    const result = await client.callTool({
      name: 'recommend_material',
      arguments: { requirements: {} },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('at least one');
  });
});
