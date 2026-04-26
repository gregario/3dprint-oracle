import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_FILENAME = '3dprint.sqlite';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export function getDatabase(dataDir?: string): Database.Database {
  let db: Database.Database;
  if (dataDir === ':memory:') {
    db = new Database(':memory:');
  } else {
    const dir = dataDir ?? __dirname;
    const dbPath = dir.endsWith('.sqlite') ? dir : path.join(dir, DB_FILENAME);
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    db = new Database(dbPath);
  }
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  return db;
}

function initializeSchema(db: Database.Database): void {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
}

export function getTableNames(db: Database.Database): string[] {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

// -- Search & query helpers --

export interface FilamentRow {
  id: number;
  name: string;
  manufacturer_id: number;
  manufacturer_name: string;
  material_id: number;
  material_name: string;
  density: number | null;
  diameter: number;
  weight: number | null;
  spool_weight: number | null;
  extruder_temp: number | null;
  extruder_temp_min: number | null;
  extruder_temp_max: number | null;
  bed_temp: number | null;
  bed_temp_min: number | null;
  bed_temp_max: number | null;
  color_name: string | null;
  color_hex: string | null;
  finish: string | null;
  translucent: number;
  glow: number;
}

export interface SearchFilters {
  material?: string;
  manufacturer?: string;
  diameter?: number;
}

export interface SearchResult {
  rows: FilamentRow[];
  total: number;
}

/**
 * Sanitize a query string for FTS5 MATCH — escape special characters.
 */
function sanitizeFtsQuery(query: string): string {
  // Remove FTS5 special chars: " * ^ ( ) { } [ ] + - ~ : OR AND NOT
  return query.replace(/["\*\^\(\)\{\}\[\]\+\-~:]/g, ' ').trim();
}

const FILAMENT_BASE_SELECT = `
  SELECT f.*, m.name AS manufacturer_name
  FROM filaments f
  JOIN manufacturers m ON f.manufacturer_id = m.id
`;

export function searchFilaments(
  db: Database.Database,
  query: string,
  filters: SearchFilters = {},
  limit = 20,
  offset = 0,
): SearchResult {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // FTS match
  const sanitized = sanitizeFtsQuery(query);
  if (sanitized.length > 0) {
    // Add wildcard suffix for prefix matching
    const ftsTerms = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"*`)
      .join(' ');
    conditions.push(
      'f.id IN (SELECT rowid FROM filaments_fts WHERE filaments_fts MATCH ?)',
    );
    params.push(ftsTerms);
  }

  // Filters
  if (filters.material) {
    conditions.push('f.material_name = ?');
    params.push(filters.material);
  }
  if (filters.manufacturer) {
    conditions.push('m.name = ?');
    params.push(filters.manufacturer);
  }
  if (filters.diameter) {
    conditions.push('f.diameter = ?');
    params.push(filters.diameter);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count
  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM filaments f
    JOIN manufacturers m ON f.manufacturer_id = m.id
    ${where}
  `;
  const { cnt } = db.prepare(countSql).get(...params) as { cnt: number };

  // Page of results
  const dataSql = `
    ${FILAMENT_BASE_SELECT}
    ${where}
    ORDER BY f.name
    LIMIT ? OFFSET ?
  `;
  const rows = db
    .prepare(dataSql)
    .all(...params, limit, offset) as FilamentRow[];

  return { rows, total: cnt };
}

export function getFilamentById(
  db: Database.Database,
  id: number,
): FilamentRow | null {
  const row = db
    .prepare(`${FILAMENT_BASE_SELECT} WHERE f.id = ?`)
    .get(id) as FilamentRow | undefined;
  return row ?? null;
}

export function getFilamentByName(
  db: Database.Database,
  name: string,
): FilamentRow | null {
  const row = db
    .prepare(`${FILAMENT_BASE_SELECT} WHERE f.name = ?`)
    .get(name) as FilamentRow | undefined;
  return row ?? null;
}

/**
 * Find filaments by name, optionally filtered by manufacturer and material.
 * Names in SpoolmanDB are often colour-only (e.g. "Jade White") and shared
 * across manufacturers/materials, so a plain name lookup is ambiguous.
 * Returns ALL matches so callers can disambiguate.
 */
export function findFilamentsByName(
  db: Database.Database,
  name: string,
  manufacturer?: string,
  material?: string,
): FilamentRow[] {
  const conditions: string[] = ['f.name = ?'];
  const params: (string | number)[] = [name];
  if (manufacturer) {
    conditions.push('m.name = ?');
    params.push(manufacturer);
  }
  if (material) {
    conditions.push('f.material_name = ?');
    params.push(material);
  }
  const sql = `${FILAMENT_BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY f.id`;
  return db.prepare(sql).all(...params) as FilamentRow[];
}

export interface ManufacturerRow {
  id: number;
  name: string;
  website: string | null;
  country: string | null;
  filament_count: number;
}

export function listManufacturers(
  db: Database.Database,
  materialFilter?: string,
): ManufacturerRow[] {
  if (materialFilter) {
    return db
      .prepare(
        `SELECT m.*, COUNT(f.id) AS filament_count
         FROM manufacturers m
         JOIN filaments f ON f.manufacturer_id = m.id
         WHERE f.material_name = ?
         GROUP BY m.id
         ORDER BY m.name`,
      )
      .all(materialFilter) as ManufacturerRow[];
  }
  return db
    .prepare(
      `SELECT m.*, COUNT(f.id) AS filament_count
       FROM manufacturers m
       JOIN filaments f ON f.manufacturer_id = m.id
       GROUP BY m.id
       ORDER BY m.name`,
    )
    .all() as ManufacturerRow[];
}

export interface MaterialRow {
  id: number;
  name: string;
  density: number | null;
  extruder_temp: number | null;
  bed_temp: number | null;
  filament_count: number;
}

export function listMaterials(db: Database.Database): MaterialRow[] {
  return db
    .prepare(
      `SELECT mat.*, COUNT(f.id) AS filament_count
       FROM materials mat
       JOIN filaments f ON f.material_id = mat.id
       GROUP BY mat.id
       ORDER BY mat.name`,
    )
    .all() as MaterialRow[];
}

export interface MaterialProfileRow {
  id: number;
  material_name: string;
  print_temp_min: number | null;
  print_temp_max: number | null;
  bed_temp_min: number | null;
  bed_temp_max: number | null;
  strength: string;
  flexibility: string;
  uv_resistance: string;
  food_safe: string;
  moisture_sensitivity: string;
  difficulty: string;
  typical_uses: string;
  pros: string;
  cons: string;
  nozzle_notes: string | null;
  enclosure_needed: number;
}

export function getMaterialProfile(
  db: Database.Database,
  name: string,
): MaterialProfileRow | null {
  const row = db
    .prepare('SELECT * FROM material_profiles WHERE material_name = ?')
    .get(name) as MaterialProfileRow | undefined;
  return row ?? null;
}

export function getAllMaterialProfiles(
  db: Database.Database,
): MaterialProfileRow[] {
  return db
    .prepare('SELECT * FROM material_profiles ORDER BY material_name')
    .all() as MaterialProfileRow[];
}

export interface TroubleshootingRow {
  id: number;
  symptom: string;
  material_name: string | null;
  cause: string;
  fix: string;
  probability: string;
}

export function getTroubleshooting(
  db: Database.Database,
  symptom: string,
  material?: string,
): TroubleshootingRow[] {
  if (material) {
    return db
      .prepare(
        `SELECT * FROM troubleshooting
         WHERE symptom = ? AND (material_name = ? OR material_name IS NULL)
         ORDER BY probability DESC`,
      )
      .all(symptom, material) as TroubleshootingRow[];
  }
  return db
    .prepare(
      `SELECT * FROM troubleshooting
       WHERE symptom = ?
       ORDER BY probability DESC`,
    )
    .all(symptom) as TroubleshootingRow[];
}

export function getAvailableSymptoms(db: Database.Database): string[] {
  const rows = db
    .prepare('SELECT DISTINCT symptom FROM troubleshooting ORDER BY symptom')
    .all() as { symptom: string }[];
  return rows.map((r) => r.symptom);
}

export function getAvailableMaterialNames(db: Database.Database): string[] {
  const rows = db
    .prepare(
      'SELECT DISTINCT material_name FROM material_profiles ORDER BY material_name',
    )
    .all() as { material_name: string }[];
  return rows.map((r) => r.material_name);
}
