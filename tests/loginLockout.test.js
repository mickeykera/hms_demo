import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { initTestDb, getTestDb, cleanupTestDb } from './setup.js';
import './test-env.js';
import app from '../src/server.js';
import {
  LOCKOUT_THRESHOLD,
  LOCKOUT_WINDOW_MS,
  isLockedOut,
  recordFailedLogin,
  clearFailedLogins,
} from '../src/config/loginLockout.js';

initTestDb();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const PASSWORD = 'correct-horse-battery';

function createUser({ username = 'target', role = 'Nurse', active = 1 } = {}) {
  const info = getTestDb()
    .prepare(
      'INSERT INTO users (username, password_hash, full_name, role, department, active) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(username, bcrypt.hashSync(PASSWORD, 4), 'Lock Target', role, 'Ward', active);
  return info.lastInsertRowid;
}

function login(username = 'target', password = 'wrong-guess') {
  return request(app).post('/api/auth/login').send({ username, password });
}

/** Ages a user's recorded attempts past the lockout window. */
function ageAttempts(userId) {
  const stale = new Date(Date.now() - LOCKOUT_WINDOW_MS - 1000).toISOString();
  getTestDb()
    .prepare('UPDATE login_attempts SET last_attempt_at = ? WHERE user_id = ?')
    .run(stale, userId);
}

describe('login lockout', () => {
  beforeEach(() => {
    cleanupTestDb();
    getTestDb().exec('DELETE FROM login_attempts');
  });

  describe('attempt tracking', () => {
    it('should allow exactly the configured number of failures before locking', () => {
      const id = createUser();
      for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
        expect(isLockedOut(id)).toBe(false);
        recordFailedLogin(id);
      }
      expect(isLockedOut(id)).toBe(true);
    });

    it('should clear the counter explicitly', () => {
      const id = createUser();
      recordFailedLogin(id);
      recordFailedLogin(id);
      clearFailedLogins(id);
      expect(isLockedOut(id)).toBe(false);
    });

    it('should expire a lockout after the window', () => {
      // Ages the recorded timestamp rather than waiting 15 real minutes, so
      // the test stays fast and deterministic.
      const id = createUser();
      for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) recordFailedLogin(id);
      expect(isLockedOut(id)).toBe(true);

      ageAttempts(id);
      expect(isLockedOut(id)).toBe(false);
    });

    it('should treat an unknown user as never locked', () => {
      expect(isLockedOut(999999)).toBe(false);
    });

    it('should be safe for a user with no attempts recorded', () => {
      const id = createUser();
      expect(() => isLockedOut(id)).not.toThrow();
      expect(() => recordFailedLogin(id)).not.toThrow();
    });
  });

  describe('POST /api/auth/login under lockout', () => {
    it('should lock after five failures and refuse the correct password', async () => {
      createUser();

      for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
        expect((await login()).status).toBe(401);
      }

      expect((await login('target', PASSWORD)).status).toBe(401);
    });

    it('should give a locked-out attempt the same response as a wrong password', async () => {
      // The anti-DoS property. If status or body differed, an attacker could
      // confirm which usernames exist and which are currently locked.
      createUser();
      const wrong = await login('target', 'wrong-guess');

      for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) await login();
      const locked = await login('target', PASSWORD);

      expect(locked.status).toBe(wrong.status);
      expect(locked.body.error).toBe(wrong.body.error);
      expect(locked.body.code).toBe(wrong.body.code);
      expect(Object.keys(locked.body).sort()).toEqual(Object.keys(wrong.body).sort());
    });

    it('should not reveal that the username does not exist', async () => {
      createUser();
      const missing = await login('no-such-user', PASSWORD);

      expect(missing.status).toBe(401);
      expect(missing.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should let the user back in once the lockout expires', async () => {
      const id = createUser();
      for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) await login();

      ageAttempts(id);

      const res = await login('target', PASSWORD);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it('should clear the counter after a successful login', async () => {
      const id = createUser();
      await login();
      await login();

      const count = () =>
        getTestDb().prepare('SELECT COUNT(*) n FROM login_attempts WHERE user_id = ?').get(id).n;

      expect(count()).toBeGreaterThan(0);
      expect((await login('target', PASSWORD)).status).toBe(200);
      expect(count()).toBe(0);
    });

    it('should not treat a deactivated account differently', async () => {
      createUser({ active: 0 });

      for (let i = 0; i < LOCKOUT_THRESHOLD + 2; i += 1) {
        const res = await login();
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('SuperAdmin unlock', () => {
    async function tokenFor(username, role) {
      const id = createUser({ username, role });
      return jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '1h' });
    }

    it('should clear the lock so the correct password works again', async () => {
      createUser();
      for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) await login();

      const token = await tokenFor('chief', 'SuperAdmin');
      const unlock = await request(app)
        .post('/api/admin/users/unlock')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'target' });

      expect(unlock.status).toBe(200);
      expect((await login('target', PASSWORD)).status).toBe(200);
    });

    it('should refuse unlock from a non-SuperAdmin', async () => {
      createUser();
      const token = await tokenFor('nurse1', 'Nurse');

      const res = await request(app)
        .post('/api/admin/users/unlock')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'target' });

      expect(res.status).toBe(403);
    });

    it('should refuse unlock without authentication', async () => {
      const res = await request(app).post('/api/admin/users/unlock').send({ username: 'target' });
      expect(res.status).toBe(401);
    });
  });
});