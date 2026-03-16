import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  getTroubleshooting,
  getAvailableSymptoms,
} from '../data/db.js';

export function registerDiagnosePrintIssue(
  server: McpServer,
  db: Database.Database,
): void {
  server.registerTool(
    'diagnose_print_issue',
    {
      title: 'Diagnose Print Issue',
      description:
        'Diagnose a 3D printing problem by symptom. Returns possible causes ranked by probability, with specific fixes for each. Optionally filter by material type for material-specific troubleshooting.',
      inputSchema: {
        symptom: z
          .string()
          .describe(
            'The print issue symptom (e.g., "stringing", "warping", "layer_adhesion", "clogging", "elephant_foot")',
          ),
        material: z
          .string()
          .optional()
          .describe(
            'Material type for material-specific diagnosis (e.g., "PLA", "PETG")',
          ),
      },
    },
    async ({ symptom, material }) => {
      const entries = getTroubleshooting(db, symptom.toLowerCase(), material);

      if (entries.length === 0) {
        const available = getAvailableSymptoms(db);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `No troubleshooting data found for symptom "${symptom}". Available symptoms: ${available.join(', ')}`,
            },
          ],
        };
      }

      // Sort: material-specific first, then by probability
      const probOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sorted = [...entries].sort((a, b) => {
        // Material-specific entries first when material is provided
        if (material) {
          const aSpecific = a.material_name ? 0 : 1;
          const bSpecific = b.material_name ? 0 : 1;
          if (aSpecific !== bSpecific) return aSpecific - bSpecific;
        }
        return (probOrder[a.probability] ?? 1) - (probOrder[b.probability] ?? 1);
      });

      const header = material
        ? `# Diagnosing "${symptom}" (${material})`
        : `# Diagnosing "${symptom}"`;

      const lines = [header, ''];
      for (const entry of sorted) {
        const materialTag = entry.material_name
          ? ` [${entry.material_name}-specific]`
          : '';
        lines.push(`## ${entry.cause}${materialTag}`);
        lines.push(`- Probability: ${entry.probability}`);
        lines.push(`- Fix: ${entry.fix}`);
        lines.push('');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
