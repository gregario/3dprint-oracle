import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { searchFilaments, type FilamentRow } from '../data/db.js';

function formatFilament(f: FilamentRow): string {
  const lines: string[] = [];
  lines.push(`- ${f.name}`);
  lines.push(`  Manufacturer: ${f.manufacturer_name} | Material: ${f.material_name}`);

  const tempParts: string[] = [];
  if (f.extruder_temp != null) {
    let tempStr = `Extruder: ${f.extruder_temp}°C`;
    if (f.extruder_temp_min != null && f.extruder_temp_max != null) {
      tempStr += ` (${f.extruder_temp_min}-${f.extruder_temp_max}°C)`;
    }
    tempParts.push(tempStr);
  }
  if (f.bed_temp != null) {
    tempParts.push(`Bed: ${f.bed_temp}°C`);
  }
  if (tempParts.length > 0) {
    lines.push(`  ${tempParts.join(' | ')}`);
  }

  const detailParts: string[] = [`${f.diameter}mm`];
  if (f.color_name) detailParts.push(`Color: ${f.color_name}`);
  if (f.color_hex) detailParts.push(`#${f.color_hex}`);
  lines.push(`  ${detailParts.join(' | ')}`);

  return lines.join('\n');
}

export function registerSearchFilaments(
  server: McpServer,
  db: Database.Database,
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
    async ({ query, material, manufacturer, diameter, limit, offset }) => {
      const clampedLimit = Math.max(1, Math.min(limit, 100));
      const result = searchFilaments(
        db,
        query,
        { material, manufacturer, diameter },
        clampedLimit,
        offset,
      );

      if (result.total === 0) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `No filaments found matching your search. Try broadening your query or use search_filaments with different filters.`,
            },
          ],
        };
      }

      const showing = result.rows.length;
      const lines: string[] = [];
      lines.push(
        `Found ${result.total} result${result.total === 1 ? '' : 's'}. Showing ${offset + 1}-${offset + showing} of ${result.total}:\n`,
      );

      for (const row of result.rows) {
        lines.push(formatFilament(row));
      }

      if (offset + showing < result.total) {
        lines.push(
          `\n--- Page ${Math.floor(offset / clampedLimit) + 1} of ${Math.ceil(result.total / clampedLimit)}. Use offset=${offset + clampedLimit} for next page. ---`,
        );
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
