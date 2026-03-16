/**
 * Fetches SpoolmanDB data from GitHub and ingests it into SQLite.
 *
 * Usage: npx tsx scripts/fetch-data.ts
 */
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../src/data/db.js';

// ── Types ──

export interface RawColor {
  name: string;
  hex: string;
}

export interface RawWeight {
  weight: number;
  spool_weight?: number;
}

export interface RawFilament {
  name: string;
  material: string;
  density?: number;
  weights: RawWeight[];
  diameters: number[];
  extruder_temp?: number;
  extruder_temp_range?: [number, number];
  bed_temp?: number;
  bed_temp_range?: [number, number];
  colors?: RawColor[];
  finish?: string;
  translucent?: boolean;
  glow?: boolean;
}

export interface RawManufacturerFile {
  manufacturer: string;
  filaments: RawFilament[];
}

export interface RawMaterial {
  material: string;
  density?: number;
  extruder_temp?: number;
  bed_temp?: number;
}

export interface ParsedFilamentRow {
  name: string;
  manufacturer: string;
  material: string;
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
  translucent: boolean;
  glow: boolean;
}

// ── Parsing ──

export function parseManufacturerFile(
  raw: RawManufacturerFile,
): ParsedFilamentRow[] {
  const rows: ParsedFilamentRow[] = [];

  for (const filament of raw.filaments) {
    const extruderTemp = filament.extruder_temp ?? null;
    const extruderMin = filament.extruder_temp_range
      ? filament.extruder_temp_range[0]
      : extruderTemp;
    const extruderMax = filament.extruder_temp_range
      ? filament.extruder_temp_range[1]
      : extruderTemp;

    const bedTemp = filament.bed_temp ?? null;
    const bedMin = filament.bed_temp_range
      ? filament.bed_temp_range[0]
      : bedTemp;
    const bedMax = filament.bed_temp_range
      ? filament.bed_temp_range[1]
      : bedTemp;

    const colors: (RawColor | null)[] =
      filament.colors && filament.colors.length > 0
        ? filament.colors
        : [null];

    for (const color of colors) {
      for (const diameter of filament.diameters) {
        for (const w of filament.weights) {
          const resolvedName = color
            ? filament.name.replace('{color_name}', color.name)
            : filament.name;

          rows.push({
            name: resolvedName,
            manufacturer: raw.manufacturer,
            material: filament.material,
            density: filament.density ?? null,
            diameter,
            weight: w.weight ?? null,
            spool_weight: w.spool_weight ?? null,
            extruder_temp: extruderTemp,
            extruder_temp_min: extruderMin,
            extruder_temp_max: extruderMax,
            bed_temp: bedTemp,
            bed_temp_min: bedMin,
            bed_temp_max: bedMax,
            color_name: color?.name ?? null,
            color_hex: color?.hex ?? null,
            finish: filament.finish ?? null,
            translucent: filament.translucent ?? false,
            glow: filament.glow ?? false,
          });
        }
      }
    }
  }

  return rows;
}

// ── GitHub API helpers ──

const REPO = 'Donkie/SpoolmanDB';
const API_BASE = `https://api.github.com/repos/${REPO}`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': '3dprint-oracle',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

async function getHeadCommit(): Promise<string> {
  const data = await fetchJson<{ sha: string }>(
    `${API_BASE}/commits/main`,
  );
  return data.sha;
}

interface GitHubContent {
  name: string;
  download_url: string;
  type: string;
}

async function listFilamentFiles(
  commitHash: string,
): Promise<GitHubContent[]> {
  const contents = await fetchJson<GitHubContent[]>(
    `${API_BASE}/contents/filaments?ref=${commitHash}`,
  );
  return contents.filter(
    (f) => f.type === 'file' && f.name.endsWith('.json'),
  );
}

async function downloadJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': '3dprint-oracle' },
  });
  if (!res.ok) {
    throw new Error(`Download error ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

// ── Main ingestion ──

async function main(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.join(__dirname, '..', 'src', 'data');

  console.error('Fetching SpoolmanDB HEAD commit...');
  const commitHash = await getHeadCommit();
  console.error(`HEAD: ${commitHash.slice(0, 8)}`);

  console.error('Listing filament files...');
  const filamentFiles = await listFilamentFiles(commitHash);
  console.error(`Found ${filamentFiles.length} manufacturer files`);

  console.error('Downloading materials.json...');
  const materialsUrl = `https://raw.githubusercontent.com/${REPO}/${commitHash}/materials.json`;
  const rawMaterials = await downloadJson<RawMaterial[]>(materialsUrl);
  console.error(`Found ${rawMaterials.length} materials`);

  // Download all manufacturer files
  console.error('Downloading manufacturer files...');
  const manufacturerData: RawManufacturerFile[] = [];
  for (const file of filamentFiles) {
    const url = `https://raw.githubusercontent.com/${REPO}/${commitHash}/filaments/${file.name}`;
    try {
      const data = await downloadJson<RawManufacturerFile>(url);
      manufacturerData.push(data);
      console.error(`  ✓ ${file.name} (${data.filaments.length} filaments)`);
    } catch (err) {
      console.error(
        `  ✗ ${file.name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // Open database and ingest
  console.error('Opening database...');
  const db = getDatabase(dataDir);

  // Clear existing data (order matters for foreign keys)
  db.exec('DELETE FROM filaments');
  db.exec('DELETE FROM manufacturers');
  db.exec('DELETE FROM materials');

  // Insert materials
  const insertMaterial = db.prepare(
    'INSERT INTO materials (name, density, extruder_temp, bed_temp) VALUES (?, ?, ?, ?)',
  );
  const materialIds = new Map<string, number>();

  const insertMaterialsTx = db.transaction(() => {
    for (const mat of rawMaterials) {
      const info = insertMaterial.run(
        mat.material,
        mat.density ?? null,
        mat.extruder_temp ?? null,
        mat.bed_temp ?? null,
      );
      materialIds.set(mat.material, Number(info.lastInsertRowid));
    }
  });
  insertMaterialsTx();

  // Insert manufacturers and filaments
  const insertManufacturer = db.prepare(
    'INSERT INTO manufacturers (name) VALUES (?)',
  );
  const insertFilament = db.prepare(`
    INSERT INTO filaments (
      name, manufacturer_id, material_id, material_name,
      density, diameter, weight, spool_weight,
      extruder_temp, extruder_temp_min, extruder_temp_max,
      bed_temp, bed_temp_min, bed_temp_max,
      color_name, color_hex, finish, translucent, glow
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalFilaments = 0;
  let totalManufacturers = 0;

  const insertAllTx = db.transaction(() => {
    for (const mfgData of manufacturerData) {
      const mfgInfo = insertManufacturer.run(mfgData.manufacturer);
      const mfgId = Number(mfgInfo.lastInsertRowid);
      totalManufacturers++;

      const rows = parseManufacturerFile(mfgData);
      for (const row of rows) {
        // Look up material ID; create if missing
        let matId = materialIds.get(row.material);
        if (matId === undefined) {
          const matInfo = insertMaterial.run(
            row.material,
            row.density,
            null,
            null,
          );
          matId = Number(matInfo.lastInsertRowid);
          materialIds.set(row.material, matId);
        }

        insertFilament.run(
          row.name,
          mfgId,
          matId,
          row.material,
          row.density,
          row.diameter,
          row.weight,
          row.spool_weight,
          row.extruder_temp,
          row.extruder_temp_min,
          row.extruder_temp_max,
          row.bed_temp,
          row.bed_temp_min,
          row.bed_temp_max,
          row.color_name,
          row.color_hex,
          row.finish,
          row.translucent ? 1 : 0,
          row.glow ? 1 : 0,
        );
        totalFilaments++;
      }
    }
  });
  insertAllTx();

  // ── Knowledge layer ingestion ──
  console.error('Ingesting curated knowledge...');
  const knowledgeDir = path.join(__dirname, '..', 'data', 'knowledge');

  // Material profiles
  const materialProfiles = JSON.parse(
    readFileSync(path.join(knowledgeDir, 'material-profiles.json'), 'utf-8'),
  ) as Array<Record<string, unknown>>;

  db.exec('DELETE FROM material_profiles');

  const insertProfile = db.prepare(`
    INSERT INTO material_profiles (
      material_name, print_temp_min, print_temp_max,
      bed_temp_min, bed_temp_max, strength, flexibility,
      uv_resistance, food_safe, moisture_sensitivity,
      difficulty, typical_uses, pros, cons,
      nozzle_notes, enclosure_needed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProfilesTx = db.transaction(() => {
    for (const p of materialProfiles) {
      insertProfile.run(
        p.material_name,
        p.print_temp_min,
        p.print_temp_max,
        p.bed_temp_min,
        p.bed_temp_max,
        p.strength,
        p.flexibility,
        p.uv_resistance,
        p.food_safe,
        p.moisture_sensitivity,
        p.difficulty,
        p.typical_uses,
        p.pros,
        p.cons,
        p.nozzle_notes ?? null,
        p.enclosure_needed ?? 0,
      );
    }
  });
  insertProfilesTx();
  console.error(`  ✓ ${materialProfiles.length} material profiles`);

  // Troubleshooting entries
  const troubleshooting = JSON.parse(
    readFileSync(path.join(knowledgeDir, 'troubleshooting.json'), 'utf-8'),
  ) as Array<Record<string, unknown>>;

  db.exec('DELETE FROM troubleshooting');

  const insertTroubleshooting = db.prepare(`
    INSERT INTO troubleshooting (symptom, material_name, cause, fix, probability)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTroubleshootingTx = db.transaction(() => {
    for (const t of troubleshooting) {
      insertTroubleshooting.run(
        t.symptom,
        t.material_name ?? null,
        t.cause,
        t.fix,
        t.probability,
      );
    }
  });
  insertTroubleshootingTx();
  console.error(`  ✓ ${troubleshooting.length} troubleshooting entries`);

  db.close();

  console.error(
    `Done: ${totalManufacturers} manufacturers, ${rawMaterials.length} materials, ${totalFilaments} filaments, ${materialProfiles.length} profiles, ${troubleshooting.length} troubleshooting entries`,
  );
}

// Only run main() when executed directly
const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
