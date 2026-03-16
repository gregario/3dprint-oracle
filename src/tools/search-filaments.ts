import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';

export function registerSearchFilaments(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'search_filaments',
    {
      title: 'Search Filaments',
      description:
        'Search 7,000+ 3D printing filaments by name, material type, manufacturer, or color. Returns filament specs including print temperatures, density, and available colors.',
      inputSchema: {
        query: z
          .string()
          .describe(
            'Search text (filament name, material, manufacturer, or color)',
          ),
        material: z
          .string()
          .optional()
          .describe('Filter by material type (e.g., "PLA", "PETG", "ABS")'),
        manufacturer: z
          .string()
          .optional()
          .describe('Filter by manufacturer name'),
        diameter: z
          .number()
          .optional()
          .describe('Filter by filament diameter in mm (1.75 or 2.85)'),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe('Max results (1-100, default 20)'),
        offset: z
          .number()
          .optional()
          .default(0)
          .describe('Pagination offset'),
      },
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
