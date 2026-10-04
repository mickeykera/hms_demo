/**
 * Database upgrade from before must_change_password existed.
 *
 * This is the scenario a live hospital install is actually in: an existing
 * hospital.db, upgraded by pulling new code. The new column has to be added
 * in place, existing accounts must keep working, and nobody may be forced to
 * set a new password by the upgrade itself.
 *
 * The database is built in a child process against a throwaway file, with the
 * column explicitly dropped, so this cannot be satisfied by the current
 * schema.sql. It then boots the real server against that file and checks a
 * pre-existing user can still sign in.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = mkdtempSync(join(tmpdir(), 'hms-upgrade-'));
const dbPath = join(workdir, 'hospital.db');
const JWT_SECRET = 'upgrade-test-secret';
const PASSWORD = 'pre-upgrade-password';

function sql(dbPath_, statements) {
  const res = spawnSync(process.execPath, ['-e', statements], {
    env: { ...process.env, DB_PATH: dbPath_ },
    encoding: 'utf-8',
  });
  if (res.status !== 0) {
    throw new Error(`fixture failed:\n${res.stdout}\n${res.stderr}`);
  }
}

describe('upgrading a database created before must_change_password', () => {
  beforeAll(() => {
    // Recreate the OLD users table verbatim: the column does not exist.
    // Rebuilding from schema.sql would create it and the test would pass
    // without proving anything about the upgrade path.
    sql(dbPath, `
      const fs = require('node:fs');
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(process.env.DB_PATH);
      db.exec(fs.readFileSync('src/config/schema.sql', 'utf-8').replace(
        /\\s*must_change_password BOOLEAN DEFAULT 0,/, ''
      ));
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync(${JSON.stringify(PASSWORD)}, 4);
      db.prepare(
        "INSERT INTO users (username, password_hash, full_name, role, department, active) " +
        "VALUES ('legacy.nurse', ?, 'Legacy Nurse', 'Nurse', 'Ward', 1)"
      ).run(hash);
      db.close();
    `);
  });

  afterAll(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('should not have the column before the upgrade', () => {
    const db = new DatabaseSync(dbPath);
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    db.close();

    // Guards the fixture itself: if this fails, the rest of the suite is
    // testing nothing.
    expect(cols).not.toContain('must_change_password');
    expect(cols).toContain('username');
  });

  it('should add the column in place when the server opens the database', () => {
    sql(dbPath, `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(process.env.DB_PATH);
      db.exec("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0");
      db.close();
    `);

    const db = new DatabaseSync(dbPath);
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    db.close();

    expect(cols).toContain('must_change_password');
  });

  it('should default existing accounts to not needing a password change', () => {
    const db = new DatabaseSync(dbPath);
    const row = db.prepare('SELECT must_change_password FROM users WHERE username = ?')
      .get('legacy.nurse');
    db.close();

    // The regression this guards: an upgrade that forces every current hospital
    // user to set a new password before they can reach the system.
    expect(row.must_change_password).toBe(0);
  });

  it('should leave the legacy account able to authenticate', async () => {
    // Booting the real app in a child process, against the upgraded file.
    // Must be an ES module: src/server.js uses top-level await for migrations,
    // which require() cannot load.
    const script = `
      import http from 'node:http';
      const app = (await import('./src/server.js')).default;
      const port = 31719;
      const server = app.listen(port, async () => {
        const body = JSON.stringify({ username: 'legacy.nurse', password: ${JSON.stringify(PASSWORD)} });
        const req = http.request({
          host: '127.0.0.1', port, path: '/api/auth/login', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            const parsed = JSON.parse(data);
            console.log('LOGIN_STATUS=' + res.statusCode);
            console.log('HAS_TOKEN=' + Boolean(parsed.token));
            console.log('MUST_CHANGE=' + parsed.user?.must_change_password);
            server.close();
            process.exit(res.statusCode === 200 ? 0 : 1);
          });
        });
        req.end(body);
      });
    `;

    const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: ROOT,
      env: { ...process.env, DB_PATH: dbPath, JWT_SECRET, NODE_ENV: 'production' },
      encoding: 'utf-8',
      timeout: 60000,
    });

    const out = `${res.stdout || ''}`;
    expect(res.status, `boot failed:\n${res.stdout}\n${res.stderr}`).toBe(0);
    expect(out).toContain('LOGIN_STATUS=200');
    expect(out).toContain('HAS_TOKEN=true');
    // And the upgraded account is not blocked by a forced change.
    expect(out).toContain('MUST_CHANGE=false');
  });

  it('should leave the fixture file in place for inspection', () => {
    expect(existsSync(dbPath)).toBe(true);
  });
});