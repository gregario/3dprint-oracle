import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server.js';
import { getDatabase } from '../../src/data/db.js';
import type Database from 'better-sqlite3';

export async function createTestClient(): Promise<{
  client: Client;
  db: Database.Database;
}> {
  const db = getDatabase(':memory:');
  seedTestData(db);

  const server = createServer({ db });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return { client, db };
}

function seedTestData(db: Database.Database): void {
  // Insert manufacturers
  db.prepare('INSERT INTO manufacturers (id, name) VALUES (?, ?)').run(
    1,
    'Bambu Lab',
  );
  db.prepare('INSERT INTO manufacturers (id, name) VALUES (?, ?)').run(
    2,
    'Prusament',
  );

  // Insert materials
  db.prepare('INSERT INTO materials (id, name, density) VALUES (?, ?, ?)').run(
    1,
    'PLA',
    1.24,
  );
  db.prepare('INSERT INTO materials (id, name, density) VALUES (?, ?, ?)').run(
    2,
    'PETG',
    1.27,
  );
  db.prepare('INSERT INTO materials (id, name, density) VALUES (?, ?, ?)').run(
    3,
    'ABS',
    1.04,
  );

  // Insert filaments (diverse test data)
  const insert = db.prepare(
    `INSERT INTO filaments (name, manufacturer_id, material_id, material_name, density, diameter, weight, extruder_temp, extruder_temp_min, extruder_temp_max, bed_temp, color_name, color_hex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insert.run(
    'Bambu Lab PLA Basic Red',
    1, 1, 'PLA', 1.24, 1.75, 1000, 220, 190, 230, 60, 'Red', 'FF0000',
  );
  insert.run(
    'Bambu Lab PLA Basic Blue',
    1, 1, 'PLA', 1.24, 1.75, 1000, 220, 190, 230, 60, 'Blue', '0000FF',
  );
  insert.run(
    'Bambu Lab PETG Basic Black',
    1, 2, 'PETG', 1.27, 1.75, 1000, 245, 230, 250, 80, 'Black', '000000',
  );
  insert.run(
    'Prusament PLA Galaxy Silver',
    2, 1, 'PLA', 1.24, 1.75, 1000, 215, 200, 220, 55, 'Galaxy Silver', 'C0C0C0',
  );
  insert.run(
    'Prusament PETG Orange',
    2, 2, 'PETG', 1.27, 1.75, 1000, 240, 230, 250, 85, 'Orange', 'FF8C00',
  );
  insert.run(
    'Prusament ABS White',
    2, 3, 'ABS', 1.04, 1.75, 1000, 255, 240, 260, 100, 'White', 'FFFFFF',
  );
  // Different diameter
  insert.run(
    'Bambu Lab PLA Basic Red 2.85',
    1, 1, 'PLA', 1.24, 2.85, 1000, 220, 190, 230, 60, 'Red', 'FF0000',
  );

  // Seed material profiles
  const insertProfile = db.prepare(
    `INSERT INTO material_profiles (material_name, print_temp_min, print_temp_max, bed_temp_min, bed_temp_max, strength, flexibility, uv_resistance, food_safe, moisture_sensitivity, difficulty, typical_uses, pros, cons, nozzle_notes, enclosure_needed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insertProfile.run('PLA', 190, 220, 20, 60, 'moderate', 'low', 'poor', 'conditionally (FDA-approved base, but printing creates porous surface)', 'low', 'beginner', 'Prototyping, decorative items, figurines', 'Easy to print, low warping, biodegradable', 'Low heat resistance (~60°C), brittle', 'Any standard brass nozzle', 0);
  insertProfile.run('PETG', 220, 250, 70, 80, 'good', 'moderate', 'moderate', 'not food safe (prints)', 'moderate', 'beginner-intermediate', 'Functional parts, outdoor items', 'Strong, chemical resistant, good layer adhesion', 'Stringing prone, scratches easily', 'Any standard brass nozzle', 0);
  insertProfile.run('ABS', 220, 250, 95, 110, 'good', 'moderate', 'moderate', 'not food safe', 'low', 'intermediate', 'Enclosures, mechanical parts', 'Impact resistant, heat resistant (~100°C), sandable', 'Warps badly, fumes, needs enclosure', 'Any standard brass nozzle', 1);

  // Seed troubleshooting
  const insertTrouble = db.prepare(
    `INSERT INTO troubleshooting (symptom, material_name, cause, fix, probability) VALUES (?, ?, ?, ?, ?)`,
  );

  insertTrouble.run('stringing', null, 'Print temperature too high', 'Lower nozzle temperature by 5°C increments', 'high');
  insertTrouble.run('stringing', null, 'Insufficient retraction', 'Increase retraction distance and speed', 'high');
  insertTrouble.run('stringing', 'PETG', 'PETG is inherently stringy', 'Use lower temps (220-230°C), enable coasting', 'high');
  insertTrouble.run('warping', null, 'Insufficient bed adhesion', 'Clean bed with IPA, use adhesive', 'high');
  insertTrouble.run('warping', 'ABS', 'ABS contracts significantly when cooling', 'Use enclosure, set bed to 100-110°C', 'high');
  insertTrouble.run('poor layer adhesion', null, 'Print temperature too low', 'Increase nozzle temperature by 5°C', 'high');
}
