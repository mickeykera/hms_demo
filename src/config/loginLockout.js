import { getDb } from '../models/index.js';

// Login lockout.
//
// Five consecutive failures locks an account for fifteen minutes. Persisted in
// SQLite rather than held in memory because an in-memory counter is cleared by
// a restart, and an attacker who can time a deploy -- or simply keep trying
// across one -- would get a fresh allowance every time.
//
// Why the response does not distinguish "locked" from "wrong password": a
// lockout is a denial-of-service vector. Anyone who knows a colleague's
// username could lock them out of a clinical system for a quarter of an hour at
// will. Returning a different status or body for a locked account would also
// confirm which usernames exist. So a locked account answers exactly what a
// wrong password answers, and only a SuperAdmin -- who can see the audit trail
// anyway -- gets a route to clear it.

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const INVALID_CREDENTIALS = Object.freeze({
  error: 'Invalid credentials',
  code: 'INVALID_CREDENTIALS',
});

/** The one response used for every failure, including a locked account. */
export function invalidCredentialsResponse() {
  return { ...INVALID_CREDENTIALS };
}

/** True when the account has reached the threshold inside the window. */
export function isLockedOut(userId, now = Date.now()) {
  if (!userId) return false;

  const row = getDb()
    .prepare('SELECT COUNT(*) AS failures FROM login_attempts WHERE user_id = ?')
    .get(userId);

  if (!row || row.failures < LOCKOUT_THRESHOLD) return false;

  const newest = getDb()
    .prepare('SELECT MAX(last_attempt_at) AS newest FROM login_attempts WHERE user_id = ?')
    .get(userId);

  // A missing timestamp cannot happen (the column is NOT NULL), but treat it
  // as "expired" rather than locking forever on unparseable data.
  if (!newest?.newest) return false;

  const elapsed = now - new Date(newest.newest).getTime();
  return elapsed < LOCKOUT_WINDOW_MS;
}

/** Records one failure, dropping attempts that have aged out of the window. */
export function recordFailedLogin(userId, now = Date.now()) {
  if (!userId) return;

  const db = getDb();
  // Expired rows are pruned on write so the table stays bounded without
  // needing a background job.
  db.prepare('DELETE FROM login_attempts WHERE user_id = ? AND last_attempt_at < ?').run(
    userId,
    new Date(now - LOCKOUT_WINDOW_MS).toISOString()
  );
  db.prepare('INSERT INTO login_attempts (user_id, attempted_at, last_attempt_at) VALUES (?, ?, ?)').run(
    userId,
    new Date(now).toISOString(),
    new Date(now).toISOString()
  );
}

export function clearFailedLogins(userId) {
  if (!userId) return;
  getDb().prepare('DELETE FROM login_attempts WHERE user_id = ?').run(userId);
}