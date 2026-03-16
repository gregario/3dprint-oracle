import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  getAllMaterialProfiles,
  type MaterialProfileRow,
} from '../data/db.js';

interface ScoredMaterial {
  profile: MaterialProfileRow;
  score: number;
  reasons: string[];
  caveats: string[];
}

function scoreStrength(
  profile: MaterialProfileRow,
  requirement: string,
): { score: number; reason: string } {
  const strengthMap: Record<string, number> = {
    low: 1,
    moderate: 2,
    good: 3,
    'very good': 4,
    excellent: 5,
  };
  const reqMap: Record<string, number> = { low: 1, medium: 2, high: 4 };
  const actual = strengthMap[profile.strength] ?? 2;
  const required = reqMap[requirement] ?? 2;
  const diff = actual - required;
  if (diff >= 0) {
    return { score: 2, reason: `Strength: ${profile.strength} (meets requirement)` };
  }
  return { score: -1, reason: `Strength: ${profile.strength} (below ${requirement} requirement)` };
}

function scoreFoodSafe(profile: MaterialProfileRow): { score: number; reason: string } {
  const fs = profile.food_safe.toLowerCase();
  if (fs.includes('conditionally') || fs.includes('fda')) {
    return { score: 1, reason: `Food safety: ${profile.food_safe}` };
  }
  return { score: -2, reason: `Not food safe: ${profile.food_safe}` };
}

function scoreOutdoor(profile: MaterialProfileRow): { score: number; reason: string } {
  const uvMap: Record<string, number> = { poor: -2, low: -1, moderate: 1, good: 2, excellent: 3 };
  const uvScore = uvMap[profile.uv_resistance] ?? 0;
  return {
    score: uvScore,
    reason: `UV resistance: ${profile.uv_resistance}`,
  };
}

function scoreEase(
  profile: MaterialProfileRow,
  requirement: string,
): { score: number; reason: string } {
  const diffMap: Record<string, number> = {
    beginner: 1,
    'beginner-intermediate': 2,
    intermediate: 3,
    'intermediate-advanced': 4,
    advanced: 5,
  };
  const reqMap: Record<string, number> = { beginner: 1, intermediate: 3, advanced: 5 };
  const actual = diffMap[profile.difficulty] ?? 3;
  const required = reqMap[requirement] ?? 3;
  if (actual <= required) {
    return { score: 2, reason: `Difficulty: ${profile.difficulty} (within skill level)` };
  }
  return { score: -1, reason: `Difficulty: ${profile.difficulty} (may be challenging for ${requirement})` };
}

export function registerRecommendMaterial(
  server: McpServer,
  db: Database.Database,
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
    async ({ requirements }) => {
      // Check if any requirements provided
      const hasRequirements = Object.values(requirements).some(
        (v) => v !== undefined && v !== null,
      );
      if (!hasRequirements) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Please provide at least one requirement (strength, flexibility, heat_resistance, food_safe, outdoor_use, ease_of_printing, or budget).',
            },
          ],
        };
      }

      const profiles = getAllMaterialProfiles(db);
      const scored: ScoredMaterial[] = profiles.map((profile) => {
        let score = 0;
        const reasons: string[] = [];
        const caveats: string[] = [];

        if (requirements.strength) {
          const r = scoreStrength(profile, requirements.strength);
          score += r.score;
          reasons.push(r.reason);
        }

        if (requirements.flexibility) {
          const flexMap: Record<string, string[]> = {
            rigid: ['low', 'none'],
            'semi-flexible': ['moderate', 'medium'],
            flexible: ['high', 'very high', 'flexible'],
          };
          const matches = flexMap[requirements.flexibility] ?? [];
          if (matches.includes(profile.flexibility.toLowerCase())) {
            score += 2;
            reasons.push(`Flexibility: ${profile.flexibility} (matches)`);
          } else {
            score -= 1;
            reasons.push(`Flexibility: ${profile.flexibility} (doesn't match ${requirements.flexibility})`);
          }
        }

        if (requirements.heat_resistance) {
          if (requirements.heat_resistance === 'high' && profile.enclosure_needed) {
            score += 2;
            reasons.push('High heat resistance (needs enclosure)');
          } else if (requirements.heat_resistance === 'high') {
            score -= 1;
            reasons.push('Limited heat resistance');
            caveats.push(profile.cons);
          } else {
            score += 1;
            reasons.push(`Heat resistance: suitable for ${requirements.heat_resistance} needs`);
          }
        }

        if (requirements.food_safe) {
          const r = scoreFoodSafe(profile);
          score += r.score;
          reasons.push(r.reason);
          if (r.score < 0) {
            caveats.push('Not suitable for food contact');
          }
        }

        if (requirements.outdoor_use) {
          const r = scoreOutdoor(profile);
          score += r.score;
          reasons.push(r.reason);
          if (r.score < 0) {
            caveats.push('Poor outdoor durability');
          }
        }

        if (requirements.ease_of_printing) {
          const r = scoreEase(profile, requirements.ease_of_printing);
          score += r.score;
          reasons.push(r.reason);
        }

        if (requirements.budget) {
          if (requirements.budget === 'low' && profile.difficulty === 'beginner') {
            score += 1;
            reasons.push('Budget-friendly (common beginner material)');
          } else if (requirements.budget === 'low') {
            score -= 1;
            reasons.push('May be more expensive than basic materials');
          } else {
            score += 1;
            reasons.push('Within budget range');
          }
        }

        return { profile, score, reasons, caveats };
      });

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      const lines = ['# Material Recommendations', ''];
      scored.forEach((s, i) => {
        lines.push(`${i + 1}. **${s.profile.material_name}** (score: ${s.score})`);
        for (const reason of s.reasons) {
          lines.push(`   - ${reason}`);
        }
        if (s.caveats.length > 0) {
          lines.push(`   - Caveats: ${s.caveats.join('; ')}`);
        }
        lines.push('');
      });

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
