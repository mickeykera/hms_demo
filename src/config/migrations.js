import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'hospital.db');
const migrationsPath = join(__dirname, 'migrations');

export async function runMigrations() {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

  const migrationTable = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.exec(migrationTable);

  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath, { recursive: true });
  }

  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace('.sql', '');
    const existing = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version);
    if (existing) continue;

    const sql = fs.readFileSync(join(migrationsPath, file), 'utf-8');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, file);
      console.log(`Applied migration: ${file}`);
    } catch (e) {
      console.error(`Failed to apply migration ${file}:`, e.message);
      throw e;
    }
  }

  db.close();
  console.log('All migrations applied successfully');
}

export function createMigration(name) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
  const filepath = join(migrationsPath, filename);

  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath, { recursive: true });
  }

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL statements here
-- Example:
-- CREATE TABLE IF NOT EXISTS example (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   name TEXT NOT NULL
-- );
`;

  fs.writeFileSync(filepath, template);
  console.log(`Created migration: ${filepath}`);
  return filepath;
}