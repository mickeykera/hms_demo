/**
 * Rebuild the demo database from nothing, in the only order that works.
 *
 * Why a script: bootstrapping requires schema.sql (applied by the models module
 * on first import) to exist *before* the SQL migrations run, because migrations
 * such as 20261001 index columns declared in schema.sql and 20261002 creates
 * tables that reference base ones. `npm run migrate` alone on a virgin file
 * used to fail with "no such table: consultations", which aborted the runner
 * before the operational tables were ever created.
 *
 * Order: schema.sql -> migrations -> demo users/beds -> demo operational data.
 * Both seeds are idempotent, so re-running tops up instead of duplicating.
 *
 * Destructive: refuses to touch an existing database unless --force is passed.
 *
 * Usage:
 *   node scripts/resetDemoDb.js            # only if no database exists yet
 *   node scripts/resetDemoDb.js --force    # wipe and rebuild an existing one
 *   DB_PATH=/tmp/x.db node scripts/resetDemoDb.js --force
 */
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '..', 'hospital.db');
const force = process.argv.includes('--force');

// Remove the -wal/-shm siblings too: leaving them behind after deleting the
// main file makes SQLite resurrect stale pages.
const artefacts = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];

if (existsSync(DB_PATH) && !force) {
  console.error(
    `Refusing to overwrite an existing database at ${DB_PATH}.\n` +
    'This script deletes it. Re-run with --force if that is what you want.'
  );
  process.exit(1);
}

for (const file of artefacts) {
  if (existsSync(file)) {
    rmSync(file);
    console.log(`removed ${file}`);
  }
}

// 1. schema.sql. models/index.js opens/creates the database and applies the
//    schema plus its column backfills as soon as it is imported.
const { getDb } = await import('../src/models/index.js');
getDb();
console.log('applied schema.sql');

// 2. SQL migrations (now safe: the base schema exists).
const { runMigrations } = await import('../src/config/migrations.js');
await runMigrations();

// 3. Demo users, departments, wards, beds, medications and personnel.
const { seedDemoData } = await import('../src/config/seed.js');
seedDemoData();

// 4. Operational demo data (patients, visits, labs, suppliers, HR, ...).
//    Run as a child process because scripts/seedDemoData.js is a CLI script
//    that opens its own connection and reports its own summary table.
execFileSync(process.execPath, [resolve(__dirname, 'seedDemoData.js')], {
  stdio: 'inherit',
  env: { ...process.env, DB_PATH },
});

console.log(`\nDemo database rebuilt at ${DB_PATH}`);