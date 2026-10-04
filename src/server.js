import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import receptionRoutes from './modules/reception/routes.js';
import clinicalRoutes from './modules/clinical/routes.js';
import billingRoutes from './modules/billing/routes.js';
import labRoutes from './modules/lab/routes.js';
import wardRoutes from './modules/ward/routes.js';
import iotRoutes from './modules/iot/routes.js';
import orRoutes from './modules/or/routes.js';
import appointmentsRoutes from './modules/appointments/routes.js';
import pharmacyRoutes from './modules/pharmacy/routes.js';
import radiologyRoutes from './modules/radiology/routes.js';
import procurementRoutes from './modules/procurement/routes.js';
import hrRoutes from './modules/hr/routes.js';
import emergencyRoutes from './modules/emergency/routes.js';
import patientRoutes from './modules/patient/routes.js';
import notificationsRoutes from './modules/notifications/routes.js';
import messagesRoutes from './modules/messages/routes.js';
import personnelRoutes from './modules/personnel/routes.js';
import rbacRoutes from './modules/rbac/routes.js';
import departmentsRoutes from './modules/departments/routes.js';
import requestsRoutes from './modules/requests/routes.js';
import documentsRoutes from './modules/documents/routes.js';
import wardsRoutes from './modules/wards/routes.js';
import dashboardsRoutes from './modules/dashboards/routes.js';
import auditRoutes from './modules/audit/routes.js';
import navigationRoutes from './modules/navigation/routes.js';
import adminRoutes from './modules/admin/routes.js';
import { authenticate, authorize, getPermissionsForRole } from './middleware/rbac.js';
import { validate } from './middleware/validation.js';
import { errorHandler, notFoundHandler, asyncHandler, AppError } from './middleware/errorHandler.js';
import { requestLogger, auditLogger } from './middleware/logger.js';
import { logResourceAction } from './middleware/auditLog.js';
import { getDb, getUserByUsername } from './models/index.js';
import { swaggerSpec } from './config/swagger.js';
import { seedDemoData } from './config/seed.js';
import { runMigrations } from './config/migrations.js';
import { resolveTrustProxy } from './config/trustProxy.js';
import { assertDemoFlagsAllowed, envFlag, isDemoMode } from './config/deploymentMode.js';
import { bootstrapAdmin, hasBootstrapEnv } from './config/bootstrapAdmin.js';

const app = express();

// TRUST_PROXY configures how many proxy hops Express may trust when resolving
// req.ip. It is environment-specific and MUST NOT be hard-coded, because the
// same image runs in two very different places:
//
//   Render demo (render.yaml sets TRUST_PROXY=3)
//     Cloudflare -> Render -> app. Observed chain:
//       X-Forwarded-For: <client>, 172.71.151.201, 10.25.170.135
//       socket remote address: ::1
//     Three trusted hops leaves the left-most entry -- the real client -- as
//     req.ip. With a lower value req.ip resolved to 10.25.170.135, an internal
//     Render address that also changed between requests from the same browser,
//     which broke per-client rate limiting and mis-attributed every audit row.
//
//   On-prem hospital LAN (TRUST_PROXY unset)
//     Caddy/nginx -> app, one hop, and the proxy is a fixed local address.
//     Defaulting to no trusted proxies means req.ip is the TCP peer -- Caddy's
//     own address. That is safe: X-Forwarded-For from a client is ignored
//     outright, so nobody can forge an audit identity or mint a fresh
//     rate-limit bucket by sending the header themselves. The trade-off is
//     that on-prem rate limiting is per-proxy rather than per-user, which is
//     the correct default for a single-tenant LAN where the proxy is the only
//     thing an attacker can reach through.
//
// A client cannot forge the Render case either. X-Forwarded-For is append-only:
// each proxy appends the peer it received from, on the right, so a client's own
// value can only ever appear on the LEFT of the chain. Express reads a fixed
// offset from the right, so a prepended entry shifts the chain without changing
// which entries are trusted. Verified: with "9.9.9.9, <real>, <cf>, <render>"
// at 3 hops req.ip is still the real client. At 4 the left-most entry becomes
// attacker-controlled and IS forgeable -- do not raise this without re-probing.
const TRUST_PROXY = resolveTrustProxy(process.env.TRUST_PROXY);
app.set('trust proxy', TRUST_PROXY.trustProxy);

// Refuse to boot with the demo conveniences enabled outside the demo profile.
// This runs before anything seeds or serves, so an on-prem install cannot come
// up with unauthenticated admin access even if the flags leaked in via an env
// file, a compose override, or an old .env someone kept.
assertDemoFlagsAllowed();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'test-secret');
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set when NODE_ENV=production.\n' +
    'Set it in your host\'s environment (on Render: Service > Environment).\n' +
    'Generate one with: openssl rand -hex 32'
  );
}

const corsOptions = {
  origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return cors(corsOptions)(req, res, next);
  }
  next();
});

app.use(express.json());
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'operational', timestamp: new Date().toISOString(), db: getDb().prepare('SELECT 1').get() ? 'connected' : 'error' });
});

// Demo seeding endpoints. Refused outside the demo profile, not merely
// discouraged: on a hospital install these would create ten accounts with
// predictable credentials and hand out admin sessions.
function assertDemoModeAllowed(req, res, next) {
  if (!isDemoMode()) {
    return next(new AppError('Not found', 404, 'NOT_FOUND'));
  }
  next();
}

app.post('/api/setup-demo', assertDemoModeAllowed, asyncHandler(async (req, res) => {
  seedDemoData();
  return res.json({ success: true, message: 'Demo users and beds created' });
}));

app.get('/api/setup-demo', assertDemoModeAllowed, asyncHandler(async (req, res) => {
  seedDemoData();
  return res.json({ success: true, message: 'Demo users and beds created' });
}));

// Interactive first-run admin creation, for operators who would rather not put
// the initial admin password in an env file at all.
//
// Safe to expose on a LAN install for exactly one reason: it 409s as soon as
// any administrator exists, so it can only ever be used on the very first boot
// (or before the first admin is created). It is not a general "create admin"
// endpoint and cannot be used to add a second SuperAdmin.
//
// Deliberately NOT mounted in the demo profile: the demo already has accounts,
// and an unauthenticated admin-creation route on a public deployment is not
// something to leave lying around.
app.post('/api/setup/bootstrap-admin', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw new AppError('Not found', 404, 'NOT_FOUND');
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const result = bootstrapAdmin({ username, password });

  if (!result.created) {
    // 409, not 404: the operator needs to be told the window has closed,
    // otherwise they will keep retrying a route that silently does nothing.
    throw new AppError(
      `Bootstrap already completed: ${result.reason}. Use the existing account, ` +
        'or create further administrators from the admin UI once signed in.',
      409,
      'BOOTSTRAP_ALREADY_DONE'
    );
  }

  res.status(201).json({
    success: true,
    username: result.username,
    message: 'Initial administrator created. Sign in and change this password immediately.',
  });
}));

app.post('/api/auth/login', validate('login'), asyncHandler(async (req, res) => {
  const user = getUserByUsername(req.validated.username);
  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  const valid = bcrypt.compareSync(req.validated.password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
      permissions: getPermissionsForRole(user.role),
    },
  });
}));

// Self-service password change.
//
// The system previously had no way for a user to change their own password at
// all, which made forced-change and lockout policy impossible: an admin could
// reset a password but the user could not rotate one. This is the primitive
// both of those features are built on.
//
// The current password must be supplied even when the caller is already
// authenticated: a stolen token should not be enough to take over the account
// permanently.
app.post('/api/auth/change-password', authenticate, validate('passwordChange'), asyncHandler(async (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(req.user.id);

  if (!user) {
    throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
  }

  // Verify the current password. Same 401 and same wording as a wrong login, so
  // this endpoint reveals nothing about the account beyond what login already
  // does.
  if (!bcrypt.compareSync(req.validated.currentPassword, user.password_hash)) {
    throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
  }

  const newPassword = req.validated.newPassword;

  // Reuse the same "password must not be the username" rule as the bootstrap,
  // so an account cannot be created under one policy and changed to another.
  if (newPassword.toLowerCase() === user.username.toLowerCase()) {
    throw new AppError('New password must not be your username', 400, 'WEAK_PASSWORD');
  }

  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(bcrypt.hashSync(newPassword, 10), user.id);

  // Deliberately records the fact of the change, never the password. Details go
  // through sanitizeBody, but this passes an explicit string so there is no
  // request body involved at all.
  auditLogger('PASSWORD_CHANGED', { userId: user.id, username: user.username });

  res.json({ success: true, message: 'Password changed.' });
}));

// Demo quick-login.
//
// The demo seeder assigns every demo account the predictable password
// "Username" in development, which is what the login page's demo tiles used to
// type. In production the seeder refuses those defaults and uses
// SEED_DEMO_PASSWORD instead, so those tiles 401 against a real deployment.
//
// This endpoint restores the one-click demo path *without* reintroducing the
// weak password: it hands out a token for an allow-listed demo username and
// never accepts, transmits, or logs a password at all.
//
// SECURITY: with DEMO_QUICK_LOGIN=true this is public, unauthenticated access
// to every demo role including SuperAdmin. That is a deliberate trade for a
// demo deployment and is why it is off unless explicitly enabled. It must stay
// off anywhere real data lives.
//
// Disabled is the default and is checked per request (not at import time) so
// tests can toggle it without reimporting the app.
function isDemoQuickLoginEnabled() {
  // Both conditions must hold. The env flag alone is not enough: if an on-prem
  // install somehow has DEMO_QUICK_LOGIN=true in its environment, this must
  // still resolve to false rather than hand a session to anyone who asks.
  return isDemoMode() && envFlag('DEMO_QUICK_LOGIN');
}

// Fixed allow-list, matching exactly the usernames the demo seeder creates.
// Deliberately not derived from the database: a user created through normal
// provisioning must not become reachable through the demo shortcut.
const DEMO_QUICK_LOGIN_USERNAMES = Object.freeze([
  'superadmin',
  'admin',
  'receptionist',
  'doctor',
  'nurse',
  'labtech',
  'pharmacy',
  'radiology',
  'billing',
  'patient',
]);

// In-memory fixed-window rate limiter.
//
// A Map keyed by client IP is enough here: this is a single endpoint on a
// single instance, and the goal is to blunt casual hammering rather than to
// provide a distributed quota. Entries are pruned on access so the map cannot
// grow without bound.
const DEMO_LOGIN_WINDOW_MS = 60_000;
const DEMO_LOGIN_MAX_PER_WINDOW = 20;
const demoLoginHits = new Map();

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimitDemoLogin(req) {
  const now = Date.now();
  const key = clientKey(req);

  for (const [k, entry] of demoLoginHits) {
    if (now - entry.start > DEMO_LOGIN_WINDOW_MS) demoLoginHits.delete(k);
  }

  const entry = demoLoginHits.get(key);
  if (!entry || now - entry.start > DEMO_LOGIN_WINDOW_MS) {
    demoLoginHits.set(key, { start: now, count: 1 });
    return true;
  }

  entry.count += 1;
  return entry.count <= DEMO_LOGIN_MAX_PER_WINDOW;
}

app.get('/api/config/public', (req, res) => {
  // Lets the login page hide the Demo Accounts section instead of rendering
  // buttons that 404. Deliberately exposes only whether the feature is on.
  res.json({ demoQuickLogin: isDemoQuickLoginEnabled() });
});

app.post('/api/auth/demo-login', asyncHandler(async (req, res) => {
  if (!isDemoQuickLoginEnabled()) {
    // 404 rather than 403: when the feature is off the endpoint should not be
    // discoverable at all, so the UI can treat it as simply absent.
    throw new AppError('Not found', 404, 'NOT_FOUND');
  }

  if (!rateLimitDemoLogin(req)) {
    console.warn(
      `[WARN] ${new Date().toISOString()} - POST /api/auth/demo-login rate limited`,
      { ip: clientKey(req), windowMs: DEMO_LOGIN_WINDOW_MS, max: DEMO_LOGIN_MAX_PER_WINDOW }
    );
    throw new AppError('Too many demo login attempts. Try again shortly.', 429, 'RATE_LIMITED');
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';

  // 404 for anything not on the list, so this endpoint cannot be used to probe
  // which real accounts exist. 401 would confirm the difference.
  if (!username || !DEMO_QUICK_LOGIN_USERNAMES.includes(username)) {
    throw new AppError('Not found', 404, 'NOT_FOUND');
  }

  const user = getUserByUsername(username);
  if (!user) {
    // Allow-listed but absent: demo seeding has not run yet.
    throw new AppError('Demo account is not available', 404, 'DEMO_ACCOUNT_UNAVAILABLE');
  }

  // No password is read or compared here. That is the whole point: the demo
  // password is a deployment secret and this path never touches it.
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // Audit trail for a public credential-issuing endpoint. Logs the username and
  // role only -- never a token, password, or Authorization header.
  console.warn(
    `[WARN] ${new Date().toISOString()} - demo quick-login issued`,
    { username: user.username, role: user.role, ip: clientKey(req) }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
      permissions: getPermissionsForRole(user.role),
    },
  });
}));

const frontendDist = join(__dirname, '..', 'frontend', 'dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false }));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    res.sendFile(join(frontendDist, 'index.html'), (err) => (err ? next(err) : undefined));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      name: 'Hospital Management System API',
      status: 'operational',
      message: 'Frontend bundle not found. Run "npm run build" to generate frontend/dist.',
      docs: '/api-docs',
    });
  });
}

app.use(authenticate);

// Core module routes
app.use('/api/reception', receptionRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/ward', wardRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/or', orRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/radiology', radiologyRoutes);
// Operational modules backing the dashboards' procurement, HR and ED tabs.
app.use('/api/procurement', procurementRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/emergency', emergencyRoutes);

// RBAC & Administration routes
app.use('/api/personnel', personnelRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/wards', wardsRoutes);
app.use('/api/admin', adminRoutes);

// Notification, messaging, and patient portal
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/dashboards', dashboardsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/navigation', navigationRoutes);

// Nothing else in the app runs migrations -- the Docker entrypoint and
// `npm start` both go straight to `node src/server.js`. Migration 20261002
// creates every operational table (suppliers, purchase_orders, ambulances,
// dispatches, system_settings and the four HR tables), so without this a
// freshly provisioned database would 500 on all of those routes.
//
// Skipped under Vitest: the harness builds its own schema in tests/setup.js
// and does not use migrations, and running them here would write to the
// developer's real database as a side effect of importing the app.
if (!process.env.VITEST) {
  await runMigrations();
}

// First-run admin bootstrap. Runs after migrations so the users table exists,
// and before the demo seeder so an on-prem install gets its admin either way.
// Idempotent: a redeploy finds the existing admin and does nothing.
if (hasBootstrapEnv() || process.env.BOOTSTRAP_ON_STARTUP === 'true') {
  try {
    bootstrapAdmin();
  } catch (err) {
    // A bad bootstrap password must not take the system down at 3am on a
    // hospital's first boot -- but it must be impossible to miss either, so
    // the process exits rather than coming up with no admin and no explanation.
    console.error(`[BOOTSTRAP] ${err.message}`);
    throw err;
  }
}

if (envFlag('SEED_DEMO_DATA') && isDemoMode()) {
  seedDemoData();

  // The base seed above only covers users, departments, roles, wards, beds and
  // medications. Everything the operational dashboards read from -- suppliers,
  // purchase orders, ambulances, dispatches, system settings and the four HR
  // tables -- is *created* by migration 20261002 but never *populated*, so on a
  // fresh deploy those tabs would render empty (verified: every one of those
  // tables had 0 rows after a cold boot).
  //
  // scripts/seedDemoData.js is a CLI script that opens its own connection, so
  // it is invoked as a child process rather than imported. It is idempotent, and
  // failures are logged rather than fatal: a demo dataset is not a good reason
  // to refuse to serve.
  try {
    execFileSync(process.execPath, [join(__dirname, '..', 'scripts', 'seedDemoData.js')], {
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch (err) {
    console.error('Operational demo data seeding failed:', err.message);
  }
}

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Hospital Management System running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);

  // Printed on every boot because TRUST_PROXY is now deployment config, not
  // code. If the proxy chain changes shape, this line is how you notice -- the
  // wrong value silently breaks per-client rate limiting and audit attribution
  // without throwing anywhere.
  console.log(`[CONFIG] deployment mode: ${isDemoMode() ? 'demo' : 'onprem'}`);
  console.log(`[CONFIG] trust proxy: ${TRUST_PROXY.description} (TRUST_PROXY=${process.env.TRUST_PROXY ?? 'unset'})`);
  if (TRUST_PROXY.hops === 0 || TRUST_PROXY.hops === false) {
    console.log('[CONFIG] req.ip resolves to the direct TCP peer; X-Forwarded-For is ignored.');
  } else if (TRUST_PROXY.trustProxy === true) {
    console.warn(
      '[CONFIG] WARNING: TRUST_PROXY=true trusts the entire X-Forwarded-For chain. A client can then ' +
        'forge req.ip, which lets them evade rate limiting and write arbitrary addresses into the audit log. ' +
        'Prefer an exact hop count.'
    );
  }
  if (isDemoMode()) {
    console.warn('[CONFIG] DEMO MODE: demo accounts and quick-login are available. Never use on real patient data.');
  }
});

export default app;