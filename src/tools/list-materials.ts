import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { listMaterials } from '../data/db.js';

export function registerListMaterials(
  server: McpServer,
  db: Database.Database,
): void {
  server.registerTool(
    'list_materials',
    {
      title: 'List Materials',
      description:
        'List all material types available in the database (PLA, PETG, ABS, TPU, Nylon, etc.) with filament counts and typical print settings. No inputs required.',
    },
    async () => {
      const materials = listMaterials(db);

      // Sort by count descending
      materials.sort((a, b) => b.filament_count - a.filament_count);

      const lines: string[] = [];
      lines.push(
        `${materials.length} material type${materials.length === 1 ? '' : 's'}:\n`,
      );

      lines.push('| Material | Filaments | Density | Extruder Temp | Bed Temp |');
      lines.push('|---|---|---|---|---|');
      for (const m of materials) {
        const density = m.density != null ? `${m.density} g/cm³` : '-';
        const extruder = m.extruder_temp != null ? `${m.extruder_temp}°C` : '-';
        const bed = m.bed_temp != null ? `${m.bed_temp}°C` : '-';
        lines.push(
          `| ${m.name} | ${m.filament_count} | ${density} | ${extruder} | ${bed} |`,
        );
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
