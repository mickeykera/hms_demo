import bcrypt from 'bcryptjs';
import { getDb } from '../models/index.js';

// First-run admin bootstrap.
//
// Without this, a hospital install has no way in: the demo seeder is the only
// thing that creates accounts, and it is refused outside the demo profile and
// blocked entirely by DEPLOYMENT_MODE. So an on-prem install needs its own
// path to the first SuperAdmin.
//
// Two supported routes, both idempotent:
//
//   BOOTSTRAP_ADMIN_USERNAME + BOOTSTRAP_ADMIN_PASSWORD
//     Unattended. For automated deploys that have no interactive terminal.
//
//   POST /api/setup/bootstrap-admin
//     Interactive, from the host's console only. Used when the admin password
//     should never sit in an env file. See routes in server.js.
//
// Either way the account is created ONCE. Re-running with the same username is
// a no-op, so a redeploy cannot silently reset the hospital's admin password
// back to an env var that has since been rotated. A conflicting re-bootstrap
// under a different username is refused, because two SuperAdmins nobody
// remembers is how a hospital ends up locked out of its own audit trail.

const MIN_PASSWORD_LENGTH = 12;

// Credentials that would be indefensible on a real install. The demo seeders
// use username-as-password, so an operator copying a demo password into the
// bootstrap vars must be stopped.
const FORBIDDEN_USERNAMES = new Set([
  'admin',
  'superadmin',
  'root',
  'administrator',
]);

function validateAdminCredentials(username, password) {
  const problems = [];

  if (!username || !String(username).trim()) {
    problems.push('BOOTSTRAP_ADMIN_USERNAME must not be empty.');
  }
  if (!password) {
    problems.push('BOOTSTRAP_ADMIN_PASSWORD must not be empty.');
  }

  const name = String(username || '').trim().toLowerCase();

  if (name && FORBIDDEN_USERNAMES.has(name)) {
    problems.push(
      `BOOTSTRAP_ADMIN_USERNAME="${username}" is a well-known default account name. ` +
        'Pick a name that would not be in anyone\'s wordlist. If you need "admin", create this ' +
        'first account under a different name and add the alias later through the UI.'
    );
  }

  if (password) {
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      problems.push(
        `BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters. ` +
          'Generate one with: openssl rand -base64 18'
      );
    }

    // The demo seeders set password == capitalised username. If someone reuses
    // that convention here, the account is no better than a demo account.
    if (name && password === name) {
      problems.push('BOOTSTRAP_ADMIN_PASSWORD must not equal the username.');
    }
    if (name && password.toLowerCase() === name) {
      problems.push('BOOTSTRAP_ADMIN_PASSWORD must not equal the username (case-insensitive).');
    }
    if (name && String(password).toLowerCase() === String(username).toLowerCase()) {
      problems.push('BOOTSTRAP_ADMIN_PASSWORD must not be a case variant of the username.');
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to create the bootstrap admin:\n  - ${problems.join('\n  - ')}`
    );
  }
}

/**
 * Creates the initial SuperAdmin, once.
 *
 * @returns {{created: boolean, reason?: string, username: string}}
 *   `created:false` means an admin already exists and nothing was touched.
 * @throws on invalid credentials. Never throws merely because an admin
 *   already exists -- a redeploy must not fail over that.
 */
export function bootstrapAdmin({ username, password, env = process.env, log = console.log } = {}) {
  const db = getDb();

  // Guard on the role, not just a non-empty users table: a hospital might
  // legitimately have staff accounts provisioned through the UI before the
  // first admin exists.
  const existingAdmin = db
    .prepare("SELECT id, username FROM users WHERE role IN ('SuperAdmin','Admin') LIMIT 1")
    .get();

  if (existingAdmin) {
    return {
      created: false,
      username: existingAdmin.username,
      reason: `an administrator already exists (${existingAdmin.username})`,
    };
  }

  const resolvedUser = (username ?? env.BOOTSTRAP_ADMIN_USERNAME ?? '').trim();
  const resolvedPassword = password ?? env.BOOTSTRAP_ADMIN_PASSWORD ?? '';

  validateAdminCredentials(resolvedUser, resolvedPassword);

  const existingUser = db
    .prepare('SELECT id, role FROM users WHERE username = ?')
    .get(resolvedUser);

  if (existingUser) {
    // The name is taken by a non-admin account. Promoting it silently would
    // attach a password chosen for a different purpose to a SuperAdmin role.
    throw new Error(
      `Cannot bootstrap: username "${resolvedUser}" already exists with role "${existingUser.role}".\n` +
        'Choose a different BOOTSTRAP_ADMIN_USERNAME, or promote the existing account through the UI.'
    );
  }

  const passwordHash = bcrypt.hashSync(resolvedPassword, 10);

  db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)'
  ).run(resolvedUser, passwordHash, 'Initial Administrator', 'SuperAdmin', 'Administration');

  // Deliberately logs the username but never the password.
  log(
    `[BOOTSTRAP] Created initial SuperAdmin "${resolvedUser}". ` +
      'Sign in and change this password before putting the system into service.'
  );

  return { created: true, username: resolvedUser };
}

/** True when bootstrap credentials are present in the environment. */
export function hasBootstrapEnv(env = process.env) {
  return Boolean(env.BOOTSTRAP_ADMIN_USERNAME && env.BOOTSTRAP_ADMIN_PASSWORD);
}