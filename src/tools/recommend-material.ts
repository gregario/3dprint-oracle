import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';

export function registerRecommendMaterial(
  server: McpServer,
  _db: Database.Database,
): void {
  server.registerTool(
    'recommend_material',
    {
      title: 'Recommend Material',
      description:
        'Recommend the best 3D printing material based on project requirements. Describe what you need (strength, flexibility, heat resistance, food safety, outdoor use, ease of printing, budget) and get ranked material suggestions with explanations.',
      inputSchema: {
        requirements: z.object({
          strength: z
            .enum(['low', 'medium', 'high'])
            .optional()
            .describe('Required mechanical strength'),
          flexibility: z
            .enum(['rigid', 'semi-flexible', 'flexible'])
            .optional()
            .describe('Required flexibility'),
          heat_resistance: z
            .enum(['low', 'medium', 'high'])
            .optional()
            .describe('Required heat resistance'),
          food_safe: z
            .boolean()
            .optional()
            .describe('Must be food-safe material'),
          outdoor_use: z
            .boolean()
            .optional()
            .describe('Will be used outdoors (needs UV resistance)'),
          ease_of_printing: z
            .enum(['beginner', 'intermediate', 'advanced'])
            .optional()
            .describe('Desired printing difficulty level'),
          budget: z
            .enum(['low', 'medium', 'high'])
            .optional()
            .describe('Budget constraint'),
        }).describe('Project requirements for material selection'),
      },
    },
    async () => {
      return { content: [{ type: 'text' as const, text: 'Not implemented yet' }] };
    },
  );
}
