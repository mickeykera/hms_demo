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