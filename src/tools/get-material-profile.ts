import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  getMaterialProfile,
  getAvailableMaterialNames,
} from '../data/db.js';

export function registerGetMaterialProfile(
  server: McpServer,
  db: Database.Database,
): void {
  server.registerTool(
    'get_material_profile',
    {
      title: 'Get Material Profile',
      description:
        'Get a detailed material science profile for a specific material type. Includes strength, flexibility, UV resistance, food safety, moisture sensitivity, difficulty level, typical uses, pros/cons, and nozzle requirements.',
      inputSchema: {
        material: z
          .string()
          .describe('Material type name (e.g., "PLA", "PETG", "ABS", "TPU")'),
      },
    },
    async ({ material }) => {
      // Try exact match first, then uppercase
      let profile = getMaterialProfile(db, material);
      if (!profile) {
        profile = getMaterialProfile(db, material.toUpperCase());
      }

      if (!profile) {
        const available = getAvailableMaterialNames(db);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Material "${material}" not found. Available materials: ${available.join(', ')}`,
            },
          ],
        };
      }

      const lines = [
        `# ${profile.material_name} Material Profile`,
        '',
        '## Temperature Settings',
        `- Print Temperature: ${profile.print_temp_min}-${profile.print_temp_max}°C`,
        `- Bed Temperature: ${profile.bed_temp_min}-${profile.bed_temp_max}°C`,
        '',
        '## Properties',
        `- Strength: ${profile.strength}`,
        `- Flexibility: ${profile.flexibility}`,
        `- UV Resistance: ${profile.uv_resistance}`,
        `- Food Safe: ${profile.food_safe}`,
        `- Moisture Sensitivity: ${profile.moisture_sensitivity}`,
        '',
        '## Printing',
        `- Difficulty: ${profile.difficulty}`,
        `- Nozzle: ${profile.nozzle_notes ?? 'No special requirements'}`,
        `- Enclosure Needed: ${profile.enclosure_needed ? 'Yes' : 'No'}`,
        '',
        '## Usage',
        `- Typical Uses: ${profile.typical_uses}`,
        `- Pros: ${profile.pros}`,
        `- Cons: ${profile.cons}`,
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
