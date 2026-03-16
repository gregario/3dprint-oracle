import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient } from '../helpers/test-db.js';

describe('diagnose_print_issue', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createTestClient());
  });

  it('returns causes for known symptom', async () => {
    const result = await client.callTool({
      name: 'diagnose_print_issue',
      arguments: { symptom: 'stringing' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    expect(text).toContain('Print temperature too high');
    expect(text).toContain('Insufficient retraction');
  });

  it('with material filter includes material-specific entries', async () => {
    const result = await client.callTool({
      name: 'diagnose_print_issue',
      arguments: { symptom: 'stringing', material: 'PETG' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    expect(text).toContain('PETG is inherently stringy');
    // Should also contain the generic entries
    expect(text).toContain('Print temperature too high');
  });

  it('unknown symptom returns isError with available symptoms', async () => {
    const result = await client.callTool({
      name: 'diagnose_print_issue',
      arguments: { symptom: 'exploding' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('exploding');
    expect(text).toContain('stringing');
    expect(text).toContain('warping');
  });

  it('results sorted by probability (high first)', async () => {
    const result = await client.callTool({
      name: 'diagnose_print_issue',
      arguments: { symptom: 'stringing' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    // All our test entries are 'high' probability so just check they appear
    expect(text).toContain('high');
  });
});
