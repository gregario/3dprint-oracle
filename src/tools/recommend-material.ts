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

// Weights for each criterion (must sum to 100)
const WEIGHTS = {
  strength: 25,
  outdoor: 20,
  ease: 20,
  budget: 15,
  flexibility: 10,
  heat: 10,
};

// Hardcoded cost tiers per material (replaces broken difficulty-as-proxy)
const COST_TIER: Record<string, 'low' | 'medium' | 'high'> = {
  PLA: 'low',
  PETG: 'low',
  ABS: 'low',
  ASA: 'medium',
  TPU: 'medium',
  Nylon: 'high',
  PC: 'high',
  PVA: 'medium',
};

function pct(fraction: number, weight: number): number {
  return Math.round(fraction * weight);
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

  let fraction: number;
  if (actual >= required) {
    fraction = 1.0; // meets or exceeds
  } else if (actual >= required - 1) {
    fraction = 0.6; // close match (e.g. "good" for "high")
  } else if (actual >= required - 2) {
    fraction = 0.3; // partial
  } else {
    fraction = 0;
  }

  const pts = pct(fraction, WEIGHTS.strength);
  const label =
    fraction >= 1.0
      ? 'meets requirement'
      : fraction >= 0.6
        ? 'close to requirement'
        : fraction >= 0.3
          ? 'below requirement'
          : 'well below requirement';
  return {
    score: pts,
    reason: `Strength: ${profile.strength} (${label}) [${pts}/${WEIGHTS.strength}]`,
  };
}

function scoreFoodSafe(profile: MaterialProfileRow): { score: number; reason: string } {
  const fs = profile.food_safe.toLowerCase();
  if (fs.includes('conditionally') || fs.includes('fda')) {
    return { score: 5, reason: `Food safety: ${profile.food_safe} [+5 bonus]` };
  }
  return { score: 0, reason: `Not food safe: ${profile.food_safe} [+0]` };
}

function scoreOutdoor(
  profile: MaterialProfileRow,
): { score: number; reason: string } {
  const uvMap: Record<string, number> = {
    poor: 0,
    low: 0.2,
    moderate: 0.6,
    good: 0.8,
    excellent: 1.0,
  };
  const fraction = uvMap[profile.uv_resistance] ?? 0.3;
  const pts = pct(fraction, WEIGHTS.outdoor);
  return {
    score: pts,
    reason: `UV resistance: ${profile.uv_resistance} [${pts}/${WEIGHTS.outdoor}]`,
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

  let fraction: number;
  if (actual <= required) {
    fraction = 1.0; // within skill level
  } else if (actual <= required + 1) {
    fraction = 0.6; // one step harder
  } else if (actual <= required + 2) {
    fraction = 0.3; // two steps harder
  } else {
    fraction = 0;
  }

  const pts = pct(fraction, WEIGHTS.ease);
  const label =
    fraction >= 1.0
      ? 'within skill level'
      : fraction >= 0.6
        ? 'slightly above skill level'
        : fraction >= 0.3
          ? 'challenging for skill level'
          : 'well above skill level';
  return {
    score: pts,
    reason: `Difficulty: ${profile.difficulty} (${label}) [${pts}/${WEIGHTS.ease}]`,
  };
}

function scoreBudget(
  profile: MaterialProfileRow,
  requirement: string,
): { score: number; reason: string } {
  const tier = COST_TIER[profile.material_name] ?? 'medium';
  const tierVal: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const reqVal: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const actual = tierVal[tier];
  const required = reqVal[requirement] ?? 2;

  let fraction: number;
  if (actual <= required) {
    fraction = 1.0; // within budget
  } else if (actual === required + 1) {
    fraction = 0.4; // one tier over
  } else {
    fraction = 0;
  }

  const pts = pct(fraction, WEIGHTS.budget);
  const label =
    fraction >= 1.0
      ? 'within budget'
      : fraction > 0
        ? 'slightly over budget'
        : 'over budget';
  return {
    score: pts,
    reason: `Cost tier: ${tier} (${label}) [${pts}/${WEIGHTS.budget}]`,
  };
}

function scoreFlexibility(
  profile: MaterialProfileRow,
  requirement: string,
): { score: number; reason: string } {
  const flexMap: Record<string, string[]> = {
    rigid: ['low', 'none'],
    'semi-flexible': ['moderate', 'medium'],
    flexible: ['high', 'very high', 'flexible'],
  };
  const matches = flexMap[requirement] ?? [];
  const isMatch = matches.includes(profile.flexibility.toLowerCase());

  let fraction: number;
  if (isMatch) {
    fraction = 1.0;
  } else {
    // Partial credit for adjacent flexibility
    const order = ['rigid', 'semi-flexible', 'flexible'];
    const reqIdx = order.indexOf(requirement);
    // Determine which bucket the profile falls into
    let actualIdx = -1;
    for (let i = 0; i < order.length; i++) {
      const bucket = flexMap[order[i]] ?? [];
      if (bucket.includes(profile.flexibility.toLowerCase())) {
        actualIdx = i;
        break;
      }
    }
    const distance = actualIdx >= 0 && reqIdx >= 0 ? Math.abs(actualIdx - reqIdx) : 2;
    fraction = distance === 1 ? 0.3 : 0;
  }

  const pts = pct(fraction, WEIGHTS.flexibility);
  const label = fraction >= 1.0 ? 'matches' : fraction > 0 ? 'partial match' : "doesn't match";
  return {
    score: pts,
    reason: `Flexibility: ${profile.flexibility} (${label} ${requirement}) [${pts}/${WEIGHTS.flexibility}]`,
  };
}

function scoreHeatResistance(
  profile: MaterialProfileRow,
  requirement: string,
): { score: number; reason: string; caveat?: string } {
  // Use enclosure_needed and print temp as proxy for heat resistance capability
  let fraction: number;
  let label: string;
  let caveat: string | undefined;

  if (requirement === 'high') {
    if (profile.enclosure_needed) {
      fraction = 1.0;
      label = 'high heat resistance (needs enclosure)';
    } else if ((profile.print_temp_max ?? 0) >= 240) {
      fraction = 0.6;
      label = 'moderate-high heat resistance';
    } else {
      fraction = 0.2;
      label = 'limited heat resistance';
      caveat = profile.cons;
    }
  } else if (requirement === 'medium') {
    if (profile.enclosure_needed || (profile.print_temp_max ?? 0) >= 240) {
      fraction = 1.0;
      label = 'meets medium heat requirement';
    } else if ((profile.print_temp_max ?? 0) >= 210) {
      fraction = 0.6;
      label = 'adequate heat resistance';
    } else {
      fraction = 0.3;
      label = 'marginal heat resistance';
    }
  } else {
    // low requirement — everything passes
    fraction = 1.0;
    label = 'meets low heat requirement';
  }

  const pts = pct(fraction, WEIGHTS.heat);
  return {
    score: pts,
    reason: `Heat resistance: ${label} [${pts}/${WEIGHTS.heat}]`,
    caveat,
  };
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
          const r = scoreFlexibility(profile, requirements.flexibility);
          score += r.score;
          reasons.push(r.reason);
        }

        if (requirements.heat_resistance) {
          const r = scoreHeatResistance(profile, requirements.heat_resistance);
          score += r.score;
          reasons.push(r.reason);
          if (r.caveat) {
            caveats.push(r.caveat);
          }
        }

        if (requirements.food_safe) {
          const r = scoreFoodSafe(profile);
          score += r.score;
          reasons.push(r.reason);
          if (r.score === 0) {
            caveats.push('Not suitable for food contact');
          }
        }

        if (requirements.outdoor_use) {
          const r = scoreOutdoor(profile);
          score += r.score;
          reasons.push(r.reason);
          if (r.score <= pct(0.2, WEIGHTS.outdoor)) {
            caveats.push('Poor outdoor durability');
          }
        }

        if (requirements.ease_of_printing) {
          const r = scoreEase(profile, requirements.ease_of_printing);
          score += r.score;
          reasons.push(r.reason);
        }

        if (requirements.budget) {
          const r = scoreBudget(profile, requirements.budget);
          score += r.score;
          reasons.push(r.reason);
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
