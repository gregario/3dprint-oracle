import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';

export function registerCompareMaterials(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'compare_materials',
    {
      title: 'Compare Materials',
      description:
        'Compare 2-3 material types side by side across all properties: strength, flexibility, heat resistance, food safety, print difficulty, and more. Useful for deciding which material to use for a project.',
      inputSchema: {
        materials: z
          .array(z.string())
          .min(2)
          .max(3)
          .describe(
            'Array of 2-3 material type names to compare (e.g., ["PLA", "PETG", "ABS"])',
          ),
      },
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
