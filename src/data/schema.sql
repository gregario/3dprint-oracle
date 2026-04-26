-- Manufacturers
CREATE TABLE IF NOT EXISTS manufacturers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  website TEXT,
  country TEXT
);

-- Materials (from SpoolmanDB materials.json)
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  density REAL,
  extruder_temp INTEGER,
  bed_temp INTEGER
);

-- Filaments (expanded: one row per filament x color x diameter x weight combo)
CREATE TABLE IF NOT EXISTS filaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manufacturer_id INTEGER NOT NULL REFERENCES manufacturers(id),
  material_id INTEGER NOT NULL REFERENCES materials(id),
  material_name TEXT NOT NULL,
  density REAL,
  diameter REAL NOT NULL,
  weight REAL,
  spool_weight REAL,
  extruder_temp INTEGER,
  extruder_temp_min INTEGER,
  extruder_temp_max INTEGER,
  bed_temp INTEGER,
  bed_temp_min INTEGER,
  bed_temp_max INTEGER,
  color_name TEXT,
  color_hex TEXT,
  finish TEXT,
  translucent INTEGER DEFAULT 0,
  glow INTEGER DEFAULT 0
);

-- FTS5 for filament search.
-- Indexed columns cover the user-meaningful free-text fields. We deliberately
-- DO NOT use content='filaments' here because manufacturer_name lives in a
-- separate table — the trigger denormalizes it on insert.
CREATE VIRTUAL TABLE IF NOT EXISTS filaments_fts USING fts5(
  name,
  manufacturer_name,
  material_name,
  color_name,
  finish,
  tokenize='porter unicode61'
);

-- Trigger to keep FTS in sync. Looks up manufacturer_name via subquery so a
-- plain INSERT INTO filaments populates the FTS row correctly. fetch-data
-- bypasses the trigger by dropping/repopulating filaments_fts in bulk for
-- speed; this trigger is the correctness path for tests and ad-hoc inserts.
CREATE TRIGGER IF NOT EXISTS filaments_ai AFTER INSERT ON filaments BEGIN
  INSERT INTO filaments_fts(rowid, name, manufacturer_name, material_name, color_name, finish)
  VALUES (
    new.id,
    new.name,
    (SELECT name FROM manufacturers WHERE id = new.manufacturer_id),
    new.material_name,
    new.color_name,
    new.finish
  );
END;

-- Material profiles (curated knowledge layer)
CREATE TABLE IF NOT EXISTS material_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_name TEXT NOT NULL UNIQUE,
  print_temp_min INTEGER,
  print_temp_max INTEGER,
  bed_temp_min INTEGER,
  bed_temp_max INTEGER,
  strength TEXT NOT NULL,
  flexibility TEXT NOT NULL,
  uv_resistance TEXT NOT NULL,
  food_safe TEXT NOT NULL,
  moisture_sensitivity TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  typical_uses TEXT NOT NULL,
  pros TEXT NOT NULL,
  cons TEXT NOT NULL,
  nozzle_notes TEXT,
  enclosure_needed INTEGER DEFAULT 0
);

-- Troubleshooting (curated knowledge layer)
CREATE TABLE IF NOT EXISTS troubleshooting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symptom TEXT NOT NULL,
  material_name TEXT,
  cause TEXT NOT NULL,
  fix TEXT NOT NULL,
  probability TEXT NOT NULL DEFAULT 'medium'
);
