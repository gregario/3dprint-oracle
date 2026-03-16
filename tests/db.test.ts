import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  getDatabase,
  getTableNames,
  searchFilaments,
  getFilamentById,
  getFilamentByName,
  listManufacturers,
  listMaterials,
  getMaterialProfile,
  getAllMaterialProfiles,
  getTroubleshooting,
  getAvailableSymptoms,
  getAvailableMaterialNames,
} from '../src/data/db.js';

describe('database', () => {
  it('creates all tables in memory', () => {
    const db = getDatabase(':memory:');
    const tables = getTableNames(db);
    expect(tables).toContain('filaments');
    expect(tables).toContain('manufacturers');
    expect(tables).toContain('materials');
    expect(tables).toContain('material_profiles');
    expect(tables).toContain('troubleshooting');
    expect(tables).toContain('filaments_fts');
    db.close();
  });
});

describe('query helpers', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  it('searchFilaments returns results matching FTS query', () => {
    const results = searchFilaments(db, 'Galaxy');
    expect(results.rows.length).toBe(1);
    expect(results.rows[0].name).toBe('Galaxy Black PLA');
  });

  it('searchFilaments returns all when query is empty', () => {
    const results = searchFilaments(db, '');
    expect(results.rows.length).toBe(3);
  });

  it('searchFilaments respects material filter', () => {
    const results = searchFilaments(db, '', { material: 'PETG' });
    expect(results.rows.length).toBe(1);
    expect(results.rows[0].material_name).toBe('PETG');
  });

  it('searchFilaments respects manufacturer filter', () => {
    const results = searchFilaments(db, '', { manufacturer: 'Prusament' });
    expect(results.rows.length).toBe(1);
    expect(results.rows[0].name).toBe('Prusament PLA');
  });

  it('searchFilaments respects diameter filter', () => {
    const results = searchFilaments(db, '', { diameter: 2.85 });
    expect(results.rows.length).toBe(1);
  });

  it('searchFilaments supports pagination', () => {
    const page1 = searchFilaments(db, '', {}, 2, 0);
    expect(page1.rows.length).toBe(2);
    expect(page1.total).toBe(3);

    const page2 = searchFilaments(db, '', {}, 2, 2);
    expect(page2.rows.length).toBe(1);
    expect(page2.total).toBe(3);
  });

  it('getFilamentById returns correct filament', () => {
    const filament = getFilamentById(db, 1);
    expect(filament).not.toBeNull();
    expect(filament!.name).toBe('Galaxy Black PLA');
  });

  it('getFilamentById returns null for missing id', () => {
    const filament = getFilamentById(db, 999);
    expect(filament).toBeNull();
  });

  it('getFilamentByName returns correct filament', () => {
    const filament = getFilamentByName(db, 'Galaxy Black PLA');
    expect(filament).not.toBeNull();
    expect(filament!.id).toBe(1);
  });

  it('getFilamentByName returns null for missing name', () => {
    const filament = getFilamentByName(db, 'Nonexistent');
    expect(filament).toBeNull();
  });

  it('listManufacturers returns all with counts', () => {
    const manufacturers = listManufacturers(db);
    expect(manufacturers.length).toBe(2);
    const hatchbox = manufacturers.find((m: any) => m.name === 'Hatchbox');
    expect(hatchbox).toBeDefined();
    expect(hatchbox!.filament_count).toBe(2);
  });

  it('listManufacturers respects material filter', () => {
    const manufacturers = listManufacturers(db, 'PETG');
    expect(manufacturers.length).toBe(1);
    expect(manufacturers[0].name).toBe('Hatchbox');
  });

  it('listMaterials returns all with counts', () => {
    const materials = listMaterials(db);
    expect(materials.length).toBe(2);
    const pla = materials.find((m: any) => m.name === 'PLA');
    expect(pla).toBeDefined();
    expect(pla!.filament_count).toBe(2);
  });

  it('getMaterialProfile returns profile by name', () => {
    const profile = getMaterialProfile(db, 'PLA');
    expect(profile).not.toBeNull();
    expect(profile!.strength).toBe('medium');
    expect(profile!.difficulty).toBe('easy');
  });

  it('getMaterialProfile returns null for missing material', () => {
    const profile = getMaterialProfile(db, 'Unobtanium');
    expect(profile).toBeNull();
  });

  it('getAllMaterialProfiles returns all profiles', () => {
    const profiles = getAllMaterialProfiles(db);
    expect(profiles.length).toBe(2);
  });

  it('getTroubleshooting returns entries by symptom', () => {
    const entries = getTroubleshooting(db, 'stringing');
    expect(entries.length).toBe(1);
    expect(entries[0].cause).toContain('temperature');
  });

  it('getTroubleshooting filters by material', () => {
    const entries = getTroubleshooting(db, 'warping', 'PLA');
    expect(entries.length).toBe(1);
    const allEntries = getTroubleshooting(db, 'warping');
    expect(allEntries.length).toBe(2);
  });

  it('getAvailableSymptoms returns distinct symptoms', () => {
    const symptoms = getAvailableSymptoms(db);
    expect(symptoms).toContain('stringing');
    expect(symptoms).toContain('warping');
    expect(symptoms.length).toBe(2);
  });

  it('getAvailableMaterialNames returns distinct profile names', () => {
    const names = getAvailableMaterialNames(db);
    expect(names).toContain('PLA');
    expect(names).toContain('PETG');
    expect(names.length).toBe(2);
  });
});

function seedTestData(db: Database.Database): void {
  // Manufacturers
  db.exec(`
    INSERT INTO manufacturers (id, name, website, country) VALUES
    (1, 'Hatchbox', 'https://hatchbox3d.com', 'US'),
    (2, 'Prusament', 'https://www.prusa3d.com', 'CZ');
  `);

  // Materials
  db.exec(`
    INSERT INTO materials (id, name, density, extruder_temp, bed_temp) VALUES
    (1, 'PLA', 1.24, 210, 60),
    (2, 'PETG', 1.27, 230, 80);
  `);

  // Filaments (3 total: 2 PLA from different mfgs, 1 PETG)
  db.exec(`
    INSERT INTO filaments (id, name, manufacturer_id, material_id, material_name, density, diameter, weight, extruder_temp, bed_temp, color_name, color_hex)
    VALUES
    (1, 'Galaxy Black PLA', 1, 1, 'PLA', 1.24, 1.75, 1000, 210, 60, 'Galaxy Black', '#1a1a2e'),
    (2, 'Prusament PLA', 2, 1, 'PLA', 1.24, 1.75, 1000, 215, 60, 'Prusa Orange', '#fa6831'),
    (3, 'Hatchbox PETG', 1, 2, 'PETG', 1.27, 2.85, 1000, 230, 80, 'True Black', '#000000');
  `);

  // Material profiles
  db.exec(`
    INSERT INTO material_profiles (material_name, print_temp_min, print_temp_max, bed_temp_min, bed_temp_max, strength, flexibility, uv_resistance, food_safe, moisture_sensitivity, difficulty, typical_uses, pros, cons)
    VALUES
    ('PLA', 190, 220, 50, 70, 'medium', 'low', 'low', 'no', 'low', 'easy', 'prototypes, figures, decorations', 'easy to print, low warping', 'brittle, low heat resistance'),
    ('PETG', 220, 250, 70, 90, 'high', 'medium', 'medium', 'varies', 'medium', 'moderate', 'functional parts, outdoor, enclosures', 'strong, chemical resistant', 'strings more, hygroscopic');
  `);

  // Troubleshooting
  db.exec(`
    INSERT INTO troubleshooting (symptom, material_name, cause, fix, probability)
    VALUES
    ('stringing', NULL, 'temperature too high', 'Lower print temp by 5-10C, increase retraction', 'high'),
    ('warping', 'PLA', 'bed adhesion issue with PLA', 'Use glue stick, increase bed temp to 65C', 'high'),
    ('warping', 'PETG', 'bed adhesion issue with PETG', 'Use PEI sheet, bed temp 80-85C, first layer slower', 'high');
  `);
}
