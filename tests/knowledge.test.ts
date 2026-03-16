import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const materialProfiles = JSON.parse(
  readFileSync(join(projectRoot, 'data/knowledge/material-profiles.json'), 'utf-8')
);
const troubleshooting = JSON.parse(
  readFileSync(join(projectRoot, 'data/knowledge/troubleshooting.json'), 'utf-8')
);

describe('material-profiles.json', () => {
  it('has profiles for 8 core materials', () => {
    const names = materialProfiles.map((p: any) => p.material_name);
    expect(names).toContain('PLA');
    expect(names).toContain('PETG');
    expect(names).toContain('ABS');
    expect(names).toContain('TPU');
    expect(names).toContain('Nylon');
    expect(names).toContain('ASA');
    expect(names).toContain('PC');
    expect(names).toContain('PVA');
  });

  it('each profile has all required fields', () => {
    const requiredFields = [
      'material_name', 'print_temp_min', 'print_temp_max',
      'bed_temp_min', 'bed_temp_max', 'strength', 'flexibility',
      'uv_resistance', 'food_safe', 'moisture_sensitivity',
      'difficulty', 'typical_uses', 'pros', 'cons'
    ];
    for (const profile of materialProfiles) {
      for (const field of requiredFields) {
        expect(profile, `${profile.material_name} missing ${field}`).toHaveProperty(field);
      }
    }
  });
});

describe('troubleshooting.json', () => {
  it('has entries for common symptoms', () => {
    const symptoms = [...new Set(troubleshooting.map((t: any) => t.symptom))];
    expect(symptoms).toContain('stringing');
    expect(symptoms).toContain('warping');
    expect(symptoms).toContain('poor layer adhesion');
    expect(symptoms).toContain('clogging');
  });

  it('each entry has required fields', () => {
    for (const entry of troubleshooting) {
      expect(entry).toHaveProperty('symptom');
      expect(entry).toHaveProperty('cause');
      expect(entry).toHaveProperty('fix');
      expect(entry).toHaveProperty('probability');
    }
  });

  it('has material-specific entries', () => {
    const withMaterial = troubleshooting.filter((t: any) => t.material_name);
    expect(withMaterial.length).toBeGreaterThan(0);
  });

  it('has general entries (no material)', () => {
    const general = troubleshooting.filter((t: any) => !t.material_name);
    expect(general.length).toBeGreaterThan(0);
  });
});
