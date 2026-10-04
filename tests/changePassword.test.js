import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { initTestDb, getTestDb, cleanupTestDb } from './setup.js';
import './test-env.js';
import app from '../src/server.js';

initTestDb();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const STRONG = 'a-sufficiently-long-password';

function createUser({ username = 'changer', password = 'original-password', role = 'Nurse' } = {}) {
  const db = getTestDb();
  const info = db
    .prepare(
      'INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)'
    )
    .run(username, bcrypt.hashSync(password, 4), 'Change Tester', role, 'Ward');
  return info.lastInsertRowid;
}

function tokenFor(userId) {
  return jwt.sign({ id: userId, username: 'changer', role: 'Nurse' }, JWT_SECRET, { expiresIn: '1h' });
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    cleanupTestDb();
  });

  it('should change the password and let the new one log in', async () => {
    const id = createUser();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: STRONG });

    expect(res.status).toBe(200);

    // The old password must stop working immediately.
    const old = await request(app)
      .post('/api/auth/login')
      .send({ username: 'changer', password: 'original-password' });
    expect(old.status).toBe(401);

    const fresh = await request(app)
      .post('/api/auth/login')
      .send({ username: 'changer', password: STRONG });
    expect(fresh.status).toBe(200);
    expect(fresh.body.token).toBeTruthy();
  });

  it('should refuse without authentication', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'original-password', newPassword: STRONG });

    expect(res.status).toBe(401);
  });

  it('should refuse when the current password is wrong', async () => {
    const id = createUser();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'not-the-password', newPassword: STRONG });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');

    // And the original must still work, proving nothing was written.
    const check = getTestDb()
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(id);
    expect(bcrypt.compareSync('original-password', check.password_hash)).toBe(true);
  });

  it('should reject a new password shorter than the minimum', async () => {
    const id = createUser();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject reusing the current password', async () => {
    const id = createUser();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: 'original-password' });

    expect(res.status).toBe(400);
  });

  it('should reject a new password equal to the username', async () => {
    // The username has to be at least 12 characters, or the length rule fires
    // first and the equality rule is never actually exercised.
    const longUsername = 'changer-long-name';
    const id = createUser({ username: longUsername });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: longUsername });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEAK_PASSWORD');
  });

  it('should reject a new password equal to the username in a different case', async () => {
    const longUsername = 'changecase-name';
    const id = createUser({ username: longUsername });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: longUsername.toUpperCase() });

    expect(res.status).toBe(400);
  });

  it('should clear must_change_password once satisfied', async () => {
    const id = createUser();
    getTestDb().prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(id);

    const before = getTestDb().prepare('SELECT must_change_password FROM users WHERE id = ?').get(id);
    expect(before.must_change_password).toBe(1);

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: STRONG });

    const after = getTestDb().prepare('SELECT must_change_password FROM users WHERE id = ?').get(id);
    expect(after.must_change_password).toBe(0);
  });

  it('should never write the password into the audit trail', async () => {
    const id = createUser();
    getTestDb().exec('DELETE FROM audit_logs');

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: STRONG });

    const rows = getTestDb().prepare('SELECT details FROM audit_logs').all();
    for (const row of rows) {
      expect(row.details).not.toContain(STRONG);
      expect(row.details).not.toContain('original-password');
    }
  });

  it('should not echo either password back in the response', async () => {
    const id = createUser();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(id)}`)
      .send({ currentPassword: 'original-password', newPassword: STRONG });

    expect(JSON.stringify(res.body)).not.toContain(STRONG);
    expect(JSON.stringify(res.body)).not.toContain('original-password');
  });
});