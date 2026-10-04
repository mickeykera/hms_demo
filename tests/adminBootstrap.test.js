import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { initTestDb, getTestDb, cleanupTestDb } from './setup.js';
import { bootstrapAdmin, hasBootstrapEnv } from '../src/config/bootstrapAdmin.js';

initTestDb();

const STRONG = 'a-sufficiently-long-password';

function countAdmins() {
  return getTestDb()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role IN ('SuperAdmin','Admin')")
    .get().n;
}

describe('First-run admin bootstrap', () => {
  let db;
  let log;

  beforeEach(() => {
    db = getTestDb();
    cleanupTestDb();
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('hasBootstrapEnv', () => {
    it('should require both variables', () => {
      expect(hasBootstrapEnv({ BOOTSTRAP_ADMIN_USERNAME: 'a', BOOTSTRAP_ADMIN_PASSWORD: 'b' })).toBe(true);
      expect(hasBootstrapEnv({ BOOTSTRAP_ADMIN_USERNAME: 'a' })).toBe(false);
      expect(hasBootstrapEnv({ BOOTSTRAP_ADMIN_PASSWORD: 'b' })).toBe(false);
      expect(hasBootstrapEnv({})).toBe(false);
    });
  });

  describe('creating the initial admin', () => {
    it('should create a SuperAdmin from explicit credentials', () => {
      const result = bootstrapAdmin({
        username: 'hms.admin',
        password: STRONG,
        env: {},
      });

      expect(result.created).toBe(true);
      expect(result.username).toBe('hms.admin');

      const row = db.prepare('SELECT * FROM users WHERE username = ?').get('hms.admin');
      expect(row.role).toBe('SuperAdmin');
      expect(row.department).toBe('Administration');
      // Stored as a bcrypt hash, never in the clear.
      expect(row.password_hash).not.toBe(STRONG);
      expect(bcrypt.compareSync(STRONG, row.password_hash)).toBe(true);
    });

    it('should read credentials from the environment', () => {
      const result = bootstrapAdmin({
        env: { BOOTSTRAP_ADMIN_USERNAME: 'env.admin', BOOTSTRAP_ADMIN_PASSWORD: STRONG },
      });

      expect(result.created).toBe(true);
      expect(db.prepare('SELECT id FROM users WHERE username = ?').get('env.admin')).toBeTruthy();
    });

    it('should never log the password', () => {
      bootstrapAdmin({ username: 'hms.admin', password: STRONG, env: {} });

      const logged = log.mock.calls.map((c) => JSON.stringify(c)).join(' ');
      expect(logged).toContain('hms.admin');
      expect(logged).not.toContain(STRONG);
    });
  });

  describe('running more than once', () => {
    it('should do nothing when an admin already exists', () => {
      bootstrapAdmin({ username: 'first.admin', password: STRONG, env: {} });

      // The critical redeploy case: a rotated password must not be reset by a
      // container restart that still has the original env var in it.
      const second = bootstrapAdmin({ username: 'other.admin', password: 'different-password-here', env: {} });

      expect(second.created).toBe(false);
      expect(second.reason).toMatch(/administrator already exists/);
      expect(db.prepare('SELECT id FROM users WHERE username = ?').get('other.admin')).toBeFalsy();
      expect(countAdmins()).toBe(1);
    });

    it('should detect an existing Admin as well as a SuperAdmin', () => {
      db.prepare(
        "INSERT INTO users (username, password_hash, full_name, role, department) VALUES ('existing.admin','x','X','Admin','Administration')"
      ).run();

      const result = bootstrapAdmin({ username: 'new.admin', password: STRONG, env: {} });

      // Guarded on the role, not on a non-empty users table: a hospital may
      // legitimately have staff accounts before the first admin exists.
      expect(result.created).toBe(false);
    });

    it('should not throw when an admin exists and the env vars are bad', () => {
      bootstrapAdmin({ username: 'first.admin', password: STRONG, env: {} });

      // A redeploy with a stale, weak password must not fail the boot.
      expect(() => bootstrapAdmin({ env: {} })).not.toThrow();
    });
  });

  describe('refusing unsafe credentials', () => {
    it('should refuse a short password', () => {
      expect(() => bootstrapAdmin({ username: 'a.admin', password: 'short', env: {} }))
        .toThrow(/at least 12 characters/);
      expect(countAdmins()).toBe(0);
    });

    it('should refuse well-known default admin names', () => {
      for (const name of ['admin', 'superadmin', 'Administrator', 'root']) {
        expect(() => bootstrapAdmin({ username: name, password: STRONG, env: {} }))
          .toThrow(/well-known default account name/);
      }
      expect(countAdmins()).toBe(0);
    });

    it('should refuse a password equal to the username', () => {
      // The demo seeders use username-as-password, so copying that convention
      // here would defeat the entire point of this module.
      expect(() => bootstrapAdmin({ username: 'adminadmin', password: 'adminadmin', env: {} }))
        .toThrow(/must not equal the username/);

      expect(() => bootstrapAdmin({ username: 'Bob.Admin', password: 'Bob.Admin', env: {} }))
        .toThrow(/must not equal the username/);
    });

    it('should refuse missing credentials', () => {
      expect(() => bootstrapAdmin({ env: {} })).toThrow(/Refusing to create the bootstrap admin/);
    });

    it('should refuse a username already taken by a non-admin', () => {
      db.prepare(
        "INSERT INTO users (username, password_hash, full_name, role, department) VALUES ('nurse1','x','N','Nurse','Ward')"
      ).run();

      // Silently promoting an existing account would attach a password chosen
      // for a different purpose to a SuperAdmin role.
      expect(() => bootstrapAdmin({ username: 'nurse1', password: STRONG, env: {} }))
        .toThrow(/already exists with role "Nurse"/);
    });
  });
});