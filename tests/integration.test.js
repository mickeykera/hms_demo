import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { initTestDb, getTestDb, cleanupTestDb, closeTestDb } from './setup.js';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../src/models/index.js';

// Set test database path before importing app
import './test-env.js';
import app from '../src/server.js';

// Initialize test database using the same connection as the API server
initTestDb();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('API Integration Tests', () => {
  let db;
  let authTokens = {};

  beforeAll(() => {
    // Ensure API server's database is initialized
    getDb();
  });

  afterAll(() => {
    // Close test database connection
    // closeTestDb(); // Don't close as it's shared with API server
  });

  beforeEach(() => {
    db = getTestDb();
    cleanupTestDb();
    // Create test users with hashed passwords
    const roles = ['Admin', 'Receptionist', 'Doctor', 'Nurse', 'LabTech', 'Billing'];
    roles.forEach(role => {
      const passwordHash = bcrypt.hashSync(role, 10);
      try {
        db.prepare('INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)')
          .run(role.toLowerCase(), passwordHash, `${role} User`, role, role === 'Admin' ? 'Admin' : role === 'Doctor' ? 'Oncology' : role === 'LabTech' ? 'Laboratory' : role === 'Billing' ? 'Finance' : role === 'Receptionist' ? 'Front Desk' : 'Ward');
      } catch (e) {}
    });

    // Generate JWT tokens for each role
    roles.forEach(role => {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(role.toLowerCase());
      console.log(`Created user ${role}:`, user);
      authTokens[role] = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      console.log(`Token for ${role}:`, authTokens[role]);
    });

    // Create test bed
    db.prepare("INSERT INTO ward_beds (ward_name, bed_number, bed_type, status) VALUES ('ICU', 'ICU-01', 'ICU', 'Available')").run();
    db.prepare("INSERT INTO ward_beds (ward_name, bed_number, bed_type, status) VALUES ('General', 'G-101', 'General', 'Available')").run();
  });

  function authHeader(token) {
    return { Authorization: `Bearer ${token}` };
  }

  describe('Health & Setup', () => {
    it('GET /api/health should return operational status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('operational');
      expect(res.body.db).toBe('connected');
    });

    it('GET /api/setup-demo should create demo data', async () => {
      const res = await request(app).get('/api/setup-demo');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without auth header', async () => {
      const res = await request(app).get('/api/reception/queue/General');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing authorization header');
    });

    it('should reject invalid token', async () => {
      const res = await request(app).get('/api/reception/queue/General').set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should accept valid token', async () => {
      const res = await request(app).get('/api/reception/queue/General').set('Authorization', `Bearer ${authTokens.Receptionist}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Reception Module', () => {
    it('POST /api/reception/register should create patient (Receptionist)', async () => {
      const res = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({
          first_name: 'New',
          last_name: 'Patient',
          date_of_birth: '1990-01-01',
          gender: 'Male',
          blood_type: 'A+',
          email: 'new@example.com',
          phone: '555-1234',
          address: '123 Test St',
          emergency_contact_name: 'Contact',
          emergency_contact_phone: '555-5678',
          insurance_provider: 'TestInsure',
          insurance_id: 'TI123',
          insurance_validity: '2026-12-31',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.global_id).toMatch(/^HMS-/);
    });

    it('POST /api/reception/register should fail for unauthorized role', async () => {
      const res = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.LabTech}`)
        .send({ first_name: 'Test', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-1234' });
      expect(res.status).toBe(403);
    });

    it('POST /api/reception/:globalId/checkin should check in patient', async () => {
      // First register
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'Checkin', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-9999' });

      const globalId = regRes.body.global_id;

      const res = await request(app)
        .post(`/api/reception/${globalId}/checkin`)
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ triage_priority: 2 });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.visit_id).toBeDefined();
      expect(res.body.queue_position).toBeDefined();
    });

    it('GET /api/reception/:globalId should return patient', async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'Get', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-8888' });

      const res = await request(app)
        .get(`/api/reception/${regRes.body.global_id}`)
        .set('Authorization', `Bearer ${authTokens.Doctor}`);
      expect(res.status).toBe(200);
      expect(res.body.patient.first_name).toBe('Get');
    });

    it('GET /api/reception/:globalId/dashboard should return full dashboard', async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'Dash', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-7777' });

      const res = await request(app)
        .get(`/api/reception/${regRes.body.global_id}/dashboard`)
        .set('Authorization', `Bearer ${authTokens.Doctor}`);
      expect(res.status).toBe(200);
      expect(res.body.profile).toBeDefined();
      expect(res.body.routing).toBeDefined();
      expect(res.body.routing.pathways).toBeDefined();
    });

    it('GET /api/reception/queue/:department should return waiting patients', async () => {
      const res = await request(app)
        .get('/api/reception/queue/General')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`);
      expect(res.status).toBe(200);
      expect(res.body.department).toBe('General');
      expect(Array.isArray(res.body.waiting_patients)).toBe(true);
    });
  });

  describe('Clinical Module', () => {
    let patientId, visitId, globalId;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'Clinical', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-6666' });
      globalId = regRes.body.global_id;
      patientId = regRes.body.patient.id;

      const checkinRes = await request(app)
        .post(`/api/reception/${globalId}/checkin`)
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ triage_priority: 3 });
      visitId = checkinRes.body.visit_id;
    });

    it('POST /api/clinical/consult should create consultation', async () => {
      const res = await request(app)
        .post('/api/clinical/consult')
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({
          visit_id: visitId,
          patient_id: patientId,
          doctor_id: db.prepare('SELECT id FROM users WHERE username = ?').get('doctor').id,
          chief_complaint: 'Headache',
          diagnosis: 'Migraine',
          treatment_plan: 'Rest, hydration, pain relief',
          notes: 'Follow up in 3 days',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.consultation_id).toBeDefined();
    });

    it('POST /api/clinical/:patientId/prescription should create prescription', async () => {
      // Create consultation first
      const doctorId = db.prepare('SELECT id FROM users WHERE username = ?').get('doctor').id;
      const consultRes = await request(app)
        .post('/api/clinical/consult')
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({ visit_id: visitId, patient_id: patientId, doctor_id: doctorId, chief_complaint: 'Test', diagnosis: 'Test', treatment_plan: 'Test', notes: '' });

      const res = await request(app)
        .post(`/api/clinical/${patientId}/prescription`)
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({
          consultation_id: consultRes.body.consultation_id,
          medication_name: 'Ibuprofen',
          dosage: '400mg',
          frequency: 'Every 6 hours',
          duration_days: 5,
          instructions: 'Take with food',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/clinical/:patientId/emr should return full EMR', async () => {
      const res = await request(app)
        .get(`/api/clinical/${patientId}/emr`)
        .set('Authorization', `Bearer ${authTokens.Doctor}`);
      expect(res.status).toBe(200);
      expect(res.body.patient).toBeDefined();
      expect(res.body.medical_history).toBeDefined();
      expect(res.body.consultations).toBeDefined();
      expect(res.body.prescriptions).toBeDefined();
    });
  });

  describe('Billing Module', () => {
    let patientId, visitId;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'Billing', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-5555' });
      patientId = regRes.body.patient.id;

      const checkinRes = await request(app)
        .post(`/api/reception/${regRes.body.global_id}/checkin`)
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ triage_priority: 3 });
      visitId = checkinRes.body.visit_id;
    });

    it('POST /api/billing/invoice should create invoice', async () => {
      const res = await request(app)
        .post('/api/billing/invoice')
        .set('Authorization', `Bearer ${authTokens.Billing}`)
        .send({ patient_id: patientId, visit_id: visitId, total_amount: 250.00, insurance_applicable: true });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invoice_number).toMatch(/^INV-/);
    });

it('GET /api/billing/:patientId should return invoices', async () => {
      const invRes = await request(app)
        .post('/api/billing/invoice')
        .set('Authorization', `Bearer ${authTokens.Billing}`)
        .send({ patient_id: patientId, visit_id: visitId, total_amount: 100, insurance_applicable: false });
      expect(invRes.status).toBe(201);

      const res = await request(app)
        .get(`/api/billing/${patientId}`)
        .set('Authorization', `Bearer ${authTokens.Billing}`);
      expect(res.status).toBe(200);
      expect(res.body.invoices.length).toBe(1);
      expect(res.body.total_unpaid).toBe(100);
    });

    it('PUT /api/billing/:id/pay should process payment', async () => {
      const invRes = await request(app)
        .post('/api/billing/invoice')
        .set('Authorization', `Bearer ${authTokens.Billing}`)
        .send({ patient_id: patientId, visit_id: visitId, total_amount: 200, insurance_applicable: false });
      const invoiceId = invRes.body.invoice.id;

      const res = await request(app)
        .put(`/api/billing/${invoiceId}/pay`)
        .set('Authorization', `Bearer ${authTokens.Billing}`)
        .send({ amount: 200 });
      expect(res.status).toBe(200);
      expect(res.body.invoice.status).toBe('Paid');
      expect(res.body.invoice.balance).toBe(0);
    });
  });

  describe('Lab Module', () => {
    let patientId;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'Lab', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-4444' });
      patientId = regRes.body.patient.id;
    });

    it('POST /api/lab/order should create lab test', async () => {
      const res = await request(app)
        .post('/api/lab/order')
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({ patient_id: patientId, test_name: 'CBC', test_type: 'Hematology', sample_id: 'SMP-TEST-001' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.test_id).toBeDefined();
    });

    it('GET /api/lab/:patientId should return tests with results', async () => {
      await request(app)
        .post('/api/lab/order')
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({ patient_id: patientId, test_name: 'Glucose', test_type: 'Chemistry', sample_id: 'SMP-TEST-002' });

      const res = await request(app)
        .get(`/api/lab/${patientId}`)
        .set('Authorization', `Bearer ${authTokens.LabTech}`);
      expect(res.status).toBe(200);
      expect(res.body.tests.length).toBe(1);
      expect(res.body.tests[0].test.test_name).toBe('Glucose');
    });

    it('POST /api/lab/:testId/result should add result and complete test', async () => {
      const orderRes = await request(app)
        .post('/api/lab/order')
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({ patient_id: patientId, test_name: 'CBC', test_type: 'Hematology', sample_id: 'SMP-TEST-003' });
      const testId = orderRes.body.test_id;

      const res = await request(app)
        .post(`/api/lab/${testId}/result`)
        .set('Authorization', `Bearer ${authTokens.LabTech}`)
        .send({ result_data: 'WBC: 7.5 K/uL', reference_range: '4.5-11.0 K/uL', flagged: false });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const tests = db.prepare('SELECT status FROM lab_tests WHERE id = ?').get(testId);
      expect(tests.status).toBe('Verified');
    });
  });

  describe('Ward Module', () => {
    let patientId;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'Ward', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-3333' });
      patientId = regRes.body.patient.id;
    });

    it('POST /api/ward/admit should admit patient to bed', async () => {
      const res = await request(app)
        .post('/api/ward/admit')
        .set('Authorization', `Bearer ${authTokens.Admin}`)
        .send({ patient_id: patientId, bed_id: 1, reason: 'Severe pneumonia' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.admission_id).toBeDefined();
      expect(res.body.bed.ward).toBe('ICU');
      // Verify bed is occupied by checking available beds API
      const bedsRes = await request(app)
        .get('/api/ward/beds')
        .set('Authorization', `Bearer ${authTokens.Admin}`);
      const bed = bedsRes.body.available_beds.find(b => b.id === 1);
      expect(bed).toBeUndefined(); // Bed 1 should no longer be available
    });

    it('POST /api/ward/discharge/:patientId should discharge patient', async () => {
      // Admit first
      await request(app)
        .post('/api/ward/admit')
        .set('Authorization', `Bearer ${authTokens.Admin}`)
        .send({ patient_id: patientId, bed_id: 2, reason: 'Observation' });

      const res = await request(app)
        .post(`/api/ward/discharge/${patientId}`)
        .set('Authorization', `Bearer ${authTokens.Admin}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify bed is available by checking available beds API
      const bedsRes = await request(app)
        .get('/api/ward/beds')
        .set('Authorization', `Bearer ${authTokens.Admin}`);
      const bed = bedsRes.body.available_beds.find(b => b.id === 2);
      expect(bed).toBeDefined(); // Bed 2 should be available again
    });

    it('GET /api/ward/beds should return available beds', async () => {
      const res = await request(app)
        .get('/api/ward/beds')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`);
      expect(res.status).toBe(200);
      expect(res.body.available_beds.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('IoT Module', () => {
    let patientId;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'IoT', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-2222' });
      patientId = regRes.body.patient.id;
    });

    it('POST /api/iot/webhook should accept telemetry', async () => {
      const res = await request(app)
        .post('/api/iot/webhook')
        .set('Authorization', `Bearer ${authTokens.Admin}`)
        .send({
          patient_id: patientId,
          device_type: 'HeartRateMonitor',
          device_id: 'HRM-001',
          telemetry_data: '{"heart_rate": 75, "spo2": 99}',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.patient_global_id).toBeDefined();
    });

    it('GET /api/iot/:patientId should return telemetry', async () => {
      await request(app)
        .post('/api/iot/webhook')
        .set('Authorization', `Bearer ${authTokens.Admin}`)
        .send({ patient_id: patientId, device_type: 'Test', device_id: 'T-001', telemetry_data: '{"value": 1}' });

      const res = await request(app)
        .get(`/api/iot/${patientId}`)
        .set('Authorization', `Bearer ${authTokens.Doctor}`);
      expect(res.status).toBe(200);
      expect(res.body.device_readings.length).toBe(1);
    });
  });

  describe('OR Module', () => {
    let patientId, surgeonId;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/reception/register')
        .set('Authorization', `Bearer ${authTokens.Receptionist}`)
        .send({ first_name: 'OR', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-1111' });
      patientId = regRes.body.patient.id;
      const doctorUser = db.prepare('SELECT id FROM users WHERE username = ?').get('doctor');
      console.log('Doctor user:', doctorUser);
      surgeonId = doctorUser.id;
    });

    it('POST /api/or/schedule should create surgery schedule', async () => {
      const res = await request(app)
        .post('/api/or/schedule')
        .set('Authorization', `Bearer ${authTokens.Admin}`)
        .send({
          patient_id: patientId,
          procedure_name: 'Appendectomy',
          scheduled_date: '2025-12-01 10:00:00',
          surgeon_id: surgeonId,
          notes: 'Laparoscopic',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.schedule_id).toBeDefined();
    });

    it('POST /api/or/:scheduleId/team should add team member', async () => {
      const schedRes = await request(app)
        .post('/api/or/schedule')
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({ patient_id: patientId, procedure_name: 'Test', scheduled_date: '2025-12-01 10:00:00', surgeon_id: surgeonId });
      const scheduleId = schedRes.body.schedule_id;

      const res = await request(app)
        .post(`/api/or/${scheduleId}/team`)
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({ member_id: surgeonId, role: 'Surgeon' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/or/:scheduleId/report should create surgical report', async () => {
      const schedRes = await request(app)
        .post('/api/or/schedule')
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({ patient_id: patientId, procedure_name: 'Test', scheduled_date: '2025-12-01 10:00:00', surgeon_id: surgeonId });
      const scheduleId = schedRes.body.schedule_id;

      const res = await request(app)
        .post(`/api/or/${scheduleId}/report`)
        .set('Authorization', `Bearer ${authTokens.Doctor}`)
        .send({
          procedure_notes: 'Appendix removed successfully',
          complications: 'None',
          outcome: 'Successful',
          surgeon_notes: 'Clean procedure',
          post_op_care_instructions: 'Pain management, follow up 1 week',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});