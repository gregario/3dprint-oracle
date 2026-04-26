import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  findFilamentsByName,
  getFilamentById,
  type FilamentRow,
} from '../data/db.js';

/**
 * Parse a search-filament display label of the form
 *   "[ID 1234] Bambu Lab — PLA — Jade White"
 * back into its parts. Returns null if the input is not in this shape.
 * The em dash (—) is the canonical separator emitted by search_filaments.
 */
export function parseDisplayLabel(input: string): {
  id?: number;
  manufacturer?: string;
  material?: string;
  name?: string;
} | null {
  const trimmed = input.trim();
  // Try to extract a leading "[ID N]" prefix.
  const idMatch = trimmed.match(/^\[ID\s+(\d+)\]\s*(.*)$/);
  let rest = trimmed;
  let id: number | undefined;
  if (idMatch) {
    id = Number(idMatch[1]);
    rest = idMatch[2].trim();
  }
  // Split on em dash with surrounding spaces. Hyphen-minus also tolerated.
  const parts = rest.split(/\s+[—–-]\s+/);
  if (parts.length === 3) {
    return {
      id,
      manufacturer: parts[0].trim(),
      material: parts[1].trim(),
      name: parts[2].trim(),
    };
  }
  if (id != null) {
    return { id };
  }
  return null;
}

function formatFilamentDetail(f: FilamentRow): string {
  const lines: string[] = [];
  lines.push(`# ${f.manufacturer_name} — ${f.material_name} — ${f.name}`);
  lines.push('');
  lines.push(`ID: ${f.id}`);
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

function formatDisambiguation(rows: FilamentRow[], name: string): string {
  const lines: string[] = [];
  lines.push(
    `Multiple filaments match name "${name}" (${rows.length} matches). Use the ID with get_filament for an exact match, or pass manufacturer/material to disambiguate:`,
  );
  lines.push('');
  for (const r of rows.slice(0, 25)) {
    lines.push(
      `- [ID ${r.id}] ${r.manufacturer_name} — ${r.material_name} — ${r.name} (${r.diameter}mm)`,
    );
  }
  if (rows.length > 25) {
    lines.push(`... and ${rows.length - 25} more.`);
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
        'Get detailed information about a specific filament. Prefer lookup by ID (the [ID <n>] value returned by search_filaments) — that is the only unambiguous key. Name lookups are accepted but many filaments share the same name (e.g. "Black", "Jade White") because SpoolmanDB names are often colour-only; if a name is ambiguous you will get back a disambiguation list with IDs. You can pass `manufacturer` and `material` alongside `name` to narrow the match, or pass the full search_filaments display label (e.g. "[ID 1234] Bambu Lab — PLA — Jade White") in the `name` field and it will be parsed.',
      inputSchema: {
        id: z
          .number()
          .optional()
          .describe(
            'Filament ID (preferred — copy the [ID N] value from search_filaments).',
          ),
        name: z
          .string()
          .optional()
          .describe(
            'Filament name. Accepts the bare name field (e.g. "Jade White"), or a full display label like "[ID 1234] Bambu Lab — PLA — Jade White".',
          ),
        manufacturer: z
          .string()
          .optional()
          .describe('Optional disambiguator when looking up by name.'),
        material: z
          .string()
          .optional()
          .describe(
            'Optional material disambiguator when looking up by name (e.g. "PLA", "PETG").',
          ),
      },
    },
    async ({ id, name, manufacturer, material }) => {
      let filament: FilamentRow | null = null;

      // 1. Direct ID lookup wins.
      if (id != null) {
        filament = getFilamentById(db, id);
      } else if (name != null) {
        // 2. Try parsing a display label first — it may contain an ID and/or
        //    manufacturer + material that uniquely identify the filament.
        const parsed = parseDisplayLabel(name);
        if (parsed?.id != null) {
          filament = getFilamentById(db, parsed.id);
        } else {
          const effectiveName = parsed?.name ?? name;
          const effectiveMfg = manufacturer ?? parsed?.manufacturer;
          const effectiveMaterial = material ?? parsed?.material;
          const matches = findFilamentsByName(
            db,
            effectiveName,
            effectiveMfg,
            effectiveMaterial,
          );
          if (matches.length === 1) {
            filament = matches[0];
          } else if (matches.length > 1) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: formatDisambiguation(matches, effectiveName),
                },
              ],
            };
          }
        }
      } else {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Please provide either an id or name. Use search_filaments to find filaments first — every result includes an [ID N] value to copy.',
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
              text: `Filament not found. Try using search_filaments to find the correct ID, then pass that ID directly.`,
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
