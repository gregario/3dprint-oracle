import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('get_material_profile', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('returns complete profile for known material (PLA)', async () => {
    const result = await client.callTool({
      name: 'get_material_profile',
      arguments: { material: 'PLA' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    expect(text).toContain('PLA');
    expect(text).toContain('190');
    expect(text).toContain('220');
    expect(text).toContain('beginner');
  });

  it('profile contains all expected fields', async () => {
    const result = await client.callTool({
      name: 'get_material_profile',
      arguments: { material: 'PLA' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Strength');
    expect(text).toContain('Flexibility');
    expect(text).toContain('UV Resistance');
    expect(text).toContain('Food Safe');
    expect(text).toContain('Moisture Sensitivity');
    expect(text).toContain('Difficulty');
    expect(text).toContain('Typical Uses');
    expect(text).toContain('Pros');
    expect(text).toContain('Cons');
    expect(text).toContain('Nozzle');
    expect(text).toContain('Enclosure');
  });

  it('unknown material returns isError with available names', async () => {
    const result = await client.callTool({
      name: 'get_material_profile',
      arguments: { material: 'UNOBTANIUM' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('UNOBTANIUM');
    expect(text).toContain('PLA');
    expect(text).toContain('PETG');
    expect(text).toContain('ABS');
  });

  it('handles case insensitively (lowercase input)', async () => {
    const result = await client.callTool({
      name: 'get_material_profile',
      arguments: { material: 'pla' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    expect(text).toContain('PLA');
  });
});
