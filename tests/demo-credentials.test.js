/**
 * Demo credential safety.
 *
 * Development keeps the documented "password == capitalised username"
 * convenience. Production must not: a publicly reachable instance seeded that
 * way hands SuperAdmin to anyone who types "admin" / "Admin".
 *
 * These tests drive the real seeder against a throwaway database and inspect
 * the stored bcrypt hashes, so they prove the actual login secret rather than
 * just the presence of a guard.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { initTestDb, cleanupTestDb } from './setup.js';
import { seedDemoData } from '../src/config/seed.js';

const SAFE_PASSWORD = 'k7Qp2xR9vTn4LmZ8wYc3';
const ORIGINALS = { NODE_ENV: process.env.NODE_ENV, SEED_DEMO_PASSWORD: process.env.SEED_DEMO_PASSWORD };

function hashFor(username) {
  return initTestDb().prepare('SELECT password_hash FROM users WHERE username = ?').get(username)?.password_hash;
}

describe('Demo credentials', () => {
  beforeEach(() => {
    // initTestDb() injects the per-worker test database into the models module,
    // which is the same connection seedDemoData() writes through.
    initTestDb();
    cleanupTestDb();
  });

  afterEach(() => {
    if (ORIGINALS.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINALS.NODE_ENV;
    if (ORIGINALS.SEED_DEMO_PASSWORD === undefined) delete process.env.SEED_DEMO_PASSWORD;
    else process.env.SEED_DEMO_PASSWORD = ORIGINALS.SEED_DEMO_PASSWORD;
  });

  it('keeps the documented demo password in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SEED_DEMO_PASSWORD;

    seedDemoData();

    expect(bcrypt.compareSync('Admin', hashFor('admin'))).toBe(true);
  });

  it('refuses to seed in production without SEED_DEMO_PASSWORD', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SEED_DEMO_PASSWORD;

    expect(() => seedDemoData()).toThrow(/SEED_DEMO_PASSWORD/);
  });

  it('refuses a production password that is a default demo password', () => {
    process.env.NODE_ENV = 'production';

    // The exact vulnerability being closed: username as password.
    for (const defaultPassword of ['Admin', 'SuperAdmin', 'Patient']) {
      process.env.SEED_DEMO_PASSWORD = defaultPassword;
      expect(() => seedDemoData(), `"${defaultPassword}" must be rejected`).toThrow(
        /must not be one of the default demo passwords/
      );
    }
  });

  it('refuses a too-short production password', () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_DEMO_PASSWORD = 'short123';

    expect(() => seedDemoData()).toThrow(/at least 16 characters/);
  });

  it('in production the default password does not work and the env password does', () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_DEMO_PASSWORD = SAFE_PASSWORD;

    seedDemoData();

    for (const username of ['admin', 'superadmin', 'patient']) {
      const hash = hashFor(username);
      expect(hash, `${username} should exist`).toBeTruthy();
      expect(bcrypt.compareSync('Admin', hash), `${username}/Admin must not authenticate`).toBe(false);
      expect(bcrypt.compareSync(SAFE_PASSWORD, hash), `${username} must accept SEED_DEMO_PASSWORD`).toBe(true);
    }
  });

  it('never stores the raw password anywhere in the database', () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_DEMO_PASSWORD = SAFE_PASSWORD;

    seedDemoData();

    const db = initTestDb();
    const rows = db.prepare('SELECT * FROM users').all();
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain(SAFE_PASSWORD);
  });
});