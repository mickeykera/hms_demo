/**
 * Database bootstrap and seed idempotency.
 *
 * These are the regression tests for the failures that made a fresh install
 * (and therefore a fresh deploy) impossible:
 *   - `20261001_consultation_soap.sql` re-added columns that schema.sql already
 *     declared, so it always died with "duplicate column name" and aborted the
 *     runner before `20261002_operational_modules` created the operational
 *     tables.
 *   - `npm run migrate` assumed schema.sql had already been applied.
 *
 * Everything runs in a child process against a throwaway database so the suite
 * never touches the developer's hospital.db and cannot leak DB_PATH into the
 * other test files.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = mkdtempSync(join(tmpdir(), 'hms-bootstrap-'));
const dbPath = join(workdir, 'hospital.db');

function reset({ force = false } = {}) {
  const args = [join(ROOT, 'scripts', 'resetDemoDb.js')];
  if (force) args.push('--force');
  return spawnSync(process.execPath, args, {
    env: { ...process.env, DB_PATH: dbPath },
    encoding: 'utf-8',
  });
}

function count(table) {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  } finally {
    db.close();
  }
}

describe('Database bootstrap', () => {
  beforeAll(() => {
    const result = reset();
    expect(
      result.status,
      `resetDemoDb failed:\n${result.stdout}\n${result.stderr}`
    ).toBe(0);
  });

  afterAll(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('creates the database from nothing', () => {
    expect(existsSync(dbPath)).toBe(true);
  });

  it('records every migration as applied', () => {
    const db = new DatabaseSync(dbPath);
    try {
      const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
      expect(versions.map((v) => v.version)).toEqual([
        '20260912_appointments_pharmacy',
        '20261001_consultation_soap',
        '20261002_operational_modules',
      ]);
    } finally {
      db.close();
    }
  });

  it('creates the operational tables that back the dashboards', () => {
    // These only exist in migration 20261002. Their absence was the symptom of
    // the runner aborting early.
    for (const table of ['suppliers', 'purchase_orders', 'ambulances', 'dispatches', 'system_settings']) {
      expect(() => count(table), `table ${table} is missing`).not.toThrow();
    }
  });

  it('seeds the operational reference data', () => {
    expect(count('users')).toBeGreaterThan(0);
    expect(count('suppliers')).toBeGreaterThan(0);
    expect(count('ambulances')).toBeGreaterThan(0);
    expect(count('system_settings')).toBeGreaterThan(0);
    expect(count('payroll_records')).toBeGreaterThan(0);
  });

  it('is idempotent: rebuilding again changes no counts', () => {
    const tables = [
      'users', 'patients', 'appointments', 'invoices', 'lab_tests',
      'suppliers', 'purchase_orders', 'ambulances', 'dispatches',
      'system_settings', 'employee_attendance', 'leave_requests',
      'payroll_records', 'performance_reviews',
    ];
    const before = tables.map(count);

    // --force is required: the script deliberately refuses to clobber an
    // existing database without it (asserted separately below).
    const result = reset({ force: true });
    expect(result.status, `second reset failed:\n${result.stderr}`).toBe(0);

    const after = tables.map(count);
    // The second run wipes the file and rebuilds it, so counts must match the
    // first build exactly -- proving the seeds do not duplicate on re-run.
    expect(after).toEqual(before);
  });

  it('refuses to overwrite an existing database without --force', () => {
    const guarded = spawnSync(process.execPath, [join(ROOT, 'scripts', 'resetDemoDb.js')], {
      env: { ...process.env, DB_PATH: dbPath },
      encoding: 'utf-8',
    });
    expect(guarded.status).not.toBe(0);
    expect(guarded.stderr).toContain('--force');
  });
});