import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';

export function registerListManufacturers(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'list_manufacturers',
    {
      title: 'List Manufacturers',
      description:
        'List all filament manufacturers in the database, with filament counts. Optionally filter to manufacturers that produce a specific material type.',
      inputSchema: {
        material: z
          .string()
          .optional()
          .describe(
            'Filter to manufacturers that produce this material type (e.g., "PLA", "PETG")',
          ),
      },
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
