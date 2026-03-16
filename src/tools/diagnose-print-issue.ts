import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';

export function registerDiagnosePrintIssue(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'diagnose_print_issue',
    {
      title: 'Diagnose Print Issue',
      description:
        'Diagnose a 3D printing problem by symptom. Returns possible causes ranked by probability, with specific fixes for each. Optionally filter by material type for material-specific troubleshooting.',
      inputSchema: {
        symptom: z
          .string()
          .describe(
            'The print issue symptom (e.g., "stringing", "warping", "layer_adhesion", "clogging", "elephant_foot")',
          ),
        material: z
          .string()
          .optional()
          .describe(
            'Material type for material-specific diagnosis (e.g., "PLA", "PETG")',
          ),
      },
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
