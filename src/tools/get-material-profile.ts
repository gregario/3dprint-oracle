import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';

export function registerGetMaterialProfile(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'get_material_profile',
    {
      title: 'Get Material Profile',
      description:
        'Get a detailed material science profile for a specific material type. Includes strength, flexibility, UV resistance, food safety, moisture sensitivity, difficulty level, typical uses, pros/cons, and nozzle requirements.',
      inputSchema: {
        material: z
          .string()
          .describe('Material type name (e.g., "PLA", "PETG", "ABS", "TPU")'),
      },
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
