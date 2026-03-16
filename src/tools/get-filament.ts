import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  getFilamentById,
  getFilamentByName,
  type FilamentRow,
} from '../data/db.js';

function formatFilamentDetail(f: FilamentRow): string {
  const lines: string[] = [];
  lines.push(`# ${f.name}`);
  lines.push('');
  lines.push(`Manufacturer: ${f.manufacturer_name}`);
  lines.push(`Material: ${f.material_name}`);
  lines.push(`Diameter: ${f.diameter}mm`);
  if (f.density != null) lines.push(`Density: ${f.density} g/cm³`);
  if (f.weight != null) lines.push(`Spool Weight: ${f.weight}g`);
  if (f.spool_weight != null)
    lines.push(`Spool (empty) Weight: ${f.spool_weight}g`);

  lines.push('');
  lines.push('## Temperatures');
  if (f.extruder_temp != null) {
    lines.push(`Extruder: ${f.extruder_temp}°C`);
    if (f.extruder_temp_min != null && f.extruder_temp_max != null) {
      lines.push(`Extruder Range: ${f.extruder_temp_min}-${f.extruder_temp_max}°C`);
    }
  }
  if (f.bed_temp != null) {
    lines.push(`Bed: ${f.bed_temp}°C`);
    if (f.bed_temp_min != null && f.bed_temp_max != null) {
      lines.push(`Bed Range: ${f.bed_temp_min}-${f.bed_temp_max}°C`);
    }
  }

  if (f.color_name || f.color_hex) {
    lines.push('');
    lines.push('## Color');
    if (f.color_name) lines.push(`Name: ${f.color_name}`);
    if (f.color_hex) lines.push(`Hex: #${f.color_hex}`);
  }

  if (f.finish || f.translucent || f.glow) {
    lines.push('');
    lines.push('## Properties');
    if (f.finish) lines.push(`Finish: ${f.finish}`);
    if (f.translucent) lines.push('Translucent: Yes');
    if (f.glow) lines.push('Glow-in-dark: Yes');
  }

  return lines.join('\n');
}

export function registerGetFilament(
  server: McpServer,
  db: Database.Database,
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
    async ({ id, name }) => {
      let filament: FilamentRow | null = null;

      if (id != null) {
        filament = getFilamentById(db, id);
      } else if (name != null) {
        filament = getFilamentByName(db, name);
      } else {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Please provide either an id or name. Use search_filaments to find filaments first.',
            },
          ],
        };
      }

      if (!filament) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Filament not found. Try using search_filaments to find the correct name or ID.`,
            },
          ],
        };
      }

      return {
        content: [
          { type: 'text' as const, text: formatFilamentDetail(filament) },
        ],
      };
    },
  );
}
