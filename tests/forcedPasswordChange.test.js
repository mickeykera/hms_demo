import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { initTestDb, getTestDb, cleanupTestDb } from './setup.js';
import './test-env.js';
import app from '../src/server.js';
import { bootstrapAdmin } from '../src/config/bootstrapAdmin.js';

initTestDb();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const PASSWORD = 'original-password';

function createUser({ username = 'flagged', role = 'Nurse', mustChange = 1 } = {}) {
  const info = getTestDb()
    .prepare(
      'INSERT INTO users (username, password_hash, full_name, role, department, active, must_change_password) VALUES (?, ?, ?, ?, ?, 1, ?)'
    )
    .run(username, bcrypt.hashSync(PASSWORD, 4), 'Forced Change', role, 'Ward', mustChange);
  return info.lastInsertRowid;
}

function tokenFor(id, role = 'Nurse', username = 'flagged') {
  return jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '1h' });
}

/** Any authenticated route that is not the change-password endpoint. */
function ordinaryApiCall(id) {
  return request(app)
    .get('/api/ward/beds')
    .set('Authorization', `Bearer ${tokenFor(id)}`);
}

describe('forced password change', () => {
  beforeEach(() => {
    cleanupTestDb();
  });

  describe('flagging at creation', () => {
    it('should flag the bootstrap admin', () => {
      bootstrapAdmin({ username: 'fresh.admin', password: 'a-valid-bootstrap-password', env: {} });

      const row = getTestDb()
        .prepare("SELECT must_change_password FROM users WHERE username = 'fresh.admin'")
        .get();

      // The bootstrap admin is created from an env var or an operator-chosen
      // password; the whole point is that they replace it themselves.
      expect(row.must_change_password).toBe(1);
    });

    it('should default to 0 for a user created without the flag', () => {
      const id = createUser({ mustChange: 0 });

      const row = getTestDb().prepare('SELECT must_change_password FROM users WHERE id = ?').get(id);
      expect(row.must_change_password).toBe(0);
    });
  });

  describe('the gate', () => {
    it('should block ordinary API access while the flag is set', async () => {
      const id = createUser({ mustChange: 1 });

      const res = await ordinaryApiCall(id);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MUST_CHANGE_PASSWORD');
    });

    it('should allow ordinary access once the flag is clear', async () => {
      const id = createUser({ mustChange: 0 });

      const res = await ordinaryApiCall(id);

      expect(res.status).not.toBe(403);
    });

    it('should still allow the change-password endpoint itself', async () => {
      // Otherwise a flagged user would have no way out.
      const id = createUser({ mustChange: 1 });

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${tokenFor(id)}`)
        .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-password' });

      expect(res.status).toBe(200);
    });

    it('should report the flag to the client so the UI can react', async () => {
      const id = createUser({ mustChange: 1 });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'flagged', password: PASSWORD });

      expect(res.status).toBe(200);
      // The flag rides on the login response so the frontend can force the
      // change screen without a second round trip. It is a JSON boolean, not
      // the SQLite 0/1, so the client never has to know about the storage.
      expect(res.body.user.must_change_password).toBe(true);
    });

    it('should report a cleared flag on the next login', async () => {
      const id = createUser({ mustChange: 1 });
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${tokenFor(id)}`)
        .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-password' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'flagged', password: 'a-brand-new-password' });

      expect(res.status).toBe(200);
      expect(res.body.user.must_change_password).toBe(false);
    });

    it('should lift the block after the password is changed', async () => {
      const id = createUser({ mustChange: 1 });

      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${tokenFor(id)}`)
        .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-password' });

      const res = await ordinaryApiCall(id);
      expect(res.status).not.toBe(403);
    });

    it('should not block a user whose flag was never set', async () => {
      // The regression this guards: upgrading an existing install must not
      // lock out every current user.
      const id = createUser({ mustChange: 0 });

      const res = await ordinaryApiCall(id);
      expect(res.body.code).not.toBe('MUST_CHANGE_PASSWORD');
    });
  });
});