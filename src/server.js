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
import { requestLogger } from './middleware/logger.js';
import { logResourceAction } from './middleware/auditLog.js';
import { getDb, getUserByUsername } from './models/index.js';
import { swaggerSpec } from './config/swagger.js';
import { seedDemoData } from './config/seed.js';
import { runMigrations } from './config/migrations.js';

const app = express();
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

app.post('/api/setup-demo', asyncHandler(async (req, res) => {
  seedDemoData();
  return res.json({ success: true, message: 'Demo users and beds created' });
}));

app.get('/api/setup-demo', asyncHandler(async (req, res) => {
  seedDemoData();
  return res.json({ success: true, message: 'Demo users and beds created' });
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
  return process.env.DEMO_QUICK_LOGIN === 'true';
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

if (process.env.SEED_DEMO_DATA === 'true') {
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
});

export default app;