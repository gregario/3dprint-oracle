import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { listManufacturers } from '../data/db.js';

export function registerListManufacturers(
  server: McpServer,
  db: Database.Database,
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
    async ({ material }) => {
      const manufacturers = listManufacturers(db, material);
      const lines: string[] = [];

      if (material) {
        lines.push(
          `${manufacturers.length} manufacturer${manufacturers.length === 1 ? '' : 's'} producing ${material}:\n`,
        );
      } else {
        lines.push(
          `${manufacturers.length} manufacturer${manufacturers.length === 1 ? '' : 's'}:\n`,
        );
      }

      lines.push('| Manufacturer | Filaments |');
      lines.push('|---|---|');
      for (const m of manufacturers) {
        lines.push(`| ${m.name} | ${m.filament_count} |`);
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
