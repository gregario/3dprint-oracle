import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';

export function registerGetFilament(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'get_filament',
    {
      title: 'Get Filament',
      description:
        'Get detailed information about a specific filament by ID or exact name. Returns full specs: temperatures, density, weight, colors, and manufacturer details.',
      inputSchema: {
        id: z.number().optional().describe('Filament ID'),
        name: z.string().optional().describe('Exact filament name'),
      },
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
