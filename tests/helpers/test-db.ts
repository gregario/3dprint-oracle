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
}
