import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  getMaterialProfile,
  getAvailableMaterialNames,
  type MaterialProfileRow,
} from '../data/db.js';

export function registerCompareMaterials(
  server: McpServer,
  db: Database.Database,
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
    async ({ materials }) => {
      const profiles: MaterialProfileRow[] = [];
      for (const name of materials) {
        let profile = getMaterialProfile(db, name);
        if (!profile) {
          profile = getMaterialProfile(db, name.toUpperCase());
        }
        if (!profile) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: `Material "${name}" not found. Cannot compare. Available materials: ${getAvailableMaterialNames(db).join(', ')}`,
              },
            ],
          };
        }
        profiles.push(profile);
      }

      const names = profiles.map((p) => p.material_name);
      const header = `# Material Comparison: ${names.join(' vs ')}\n`;

      const properties: { label: string; getter: (p: MaterialProfileRow) => string }[] = [
        { label: 'Print Temp', getter: (p) => `${p.print_temp_min}-${p.print_temp_max}°C` },
        { label: 'Bed Temp', getter: (p) => `${p.bed_temp_min}-${p.bed_temp_max}°C` },
        { label: 'Strength', getter: (p) => p.strength },
        { label: 'Flexibility', getter: (p) => p.flexibility },
        { label: 'UV Resistance', getter: (p) => p.uv_resistance },
        { label: 'Food Safe', getter: (p) => p.food_safe },
        { label: 'Moisture Sensitivity', getter: (p) => p.moisture_sensitivity },
        { label: 'Difficulty', getter: (p) => p.difficulty },
        { label: 'Enclosure Needed', getter: (p) => p.enclosure_needed ? 'Yes' : 'No' },
        { label: 'Nozzle', getter: (p) => p.nozzle_notes ?? 'Standard' },
      ];

      // Build table
      const colWidth = 25;
      const labelWidth = 22;
      const separator = '-'.repeat(labelWidth + colWidth * names.length + names.length + 1);

      let table = `| ${'Property'.padEnd(labelWidth)}|`;
      for (const name of names) {
        table += ` ${name.padEnd(colWidth - 1)}|`;
      }
      table += '\n' + separator + '\n';

      for (const prop of properties) {
        let row = `| ${prop.label.padEnd(labelWidth)}|`;
        for (const profile of profiles) {
          const val = prop.getter(profile);
          row += ` ${val.substring(0, colWidth - 2).padEnd(colWidth - 1)}|`;
        }
        table += row + '\n';
      }

      // When to use summary
      const whenToUse = profiles
        .map(
          (p) => `- **${p.material_name}**: ${p.typical_uses} (${p.pros})`,
        )
        .join('\n');

      const text = [
        header,
        table,
        '',
        '## When to use each',
        whenToUse,
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
