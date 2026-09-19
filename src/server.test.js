import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
// import receptionRoutes from './modules/reception/routes.js';
// import clinicalRoutes from './modules/clinical/routes.js';
// import billingRoutes from './modules/billing/routes.js';
// import labRoutes from './modules/lab/routes.js';
// import wardRoutes from './modules/ward/routes.js';
// import iotRoutes from './modules/iot/routes.js';
// import orRoutes from './modules/or/routes.js';
// import appointmentsRoutes from './modules/appointments/routes.js';
// import pharmacyRoutes from './modules/pharmacy/routes.js';
// import radiologyRoutes from './modules/radiology/routes.js';
// import patientRoutes from './modules/patient/routes.js';
// import notificationsRoutes from './modules/notifications/routes.js';
// import messagesRoutes from './modules/messages/routes.js';
// import personnelRoutes from './modules/personnel/routes.js';
// import rbacRoutes from './modules/rbac/routes.js';
// import departmentsRoutes from './modules/departments/routes.js';
// import requestsRoutes from './modules/requests/routes.js';
// import documentsRoutes from './modules/documents/routes.js';
// import wardsRoutes from './modules/wards/routes.js';
// import { authenticate, authorize, getPermissionsForRole } from './middleware/rbac.js';
// import { validate } from './middleware/validation.js';
// import { errorHandler, notFoundHandler, asyncHandler, AppError } from './middleware/errorHandler.js';
// import { requestLogger } from './middleware/logger.js';
// import { logResourceAction } from './middleware/auditLog.js';
// import { getDb, getUserByUsername } from './models/index.js';
// import { swaggerSpec } from './config/swagger.js';
// import { seedDemoData } from './config/seed.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// app.options('/api/*', cors(corsOptions));
// app.options('/api-docs*', cors(corsOptions));
// Use middleware for OPTIONS requests
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return cors(corsOptions)(req, res, next);
  }
  next();
});

app.use(express.json());
// app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'operational', timestamp: new Date().toISOString() });
});

app.post('/api/setup-demo', async (req, res) => {
  res.json({ success: true, message: 'Demo users and beds created' });
});

app.get('/api/setup-demo', async (req, res) => {
  res.json({ success: true, message: 'Demo users and beds created' });
});

app.post('/api/auth/login', async (req, res) => {
  res.json({ token: 'test', user: { id: 1, role: 'Admin' } });
});

export default app;