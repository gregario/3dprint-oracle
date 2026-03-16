import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';

export function registerListMaterials(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'list_materials',
    {
      title: 'List Materials',
      description:
        'List all material types available in the database (PLA, PETG, ABS, TPU, Nylon, etc.) with filament counts and typical print settings. No inputs required.',
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
