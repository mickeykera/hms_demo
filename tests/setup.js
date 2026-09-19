import { beforeAll, afterAll, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { setTestDatabase } from '../src/models/index.js';

// This will be initialized after the app is imported
let testDb = null;

export function initTestDb() {
  if (testDb) return testDb;
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const testDbPath = join(__dirname, '..', 'test-hospital.db');
  
  testDb = new DatabaseSync(testDbPath);
  testDb.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
  
  const schemaPath = join(__dirname, '..', 'src', 'config', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  testDb.exec(schema);
  
  // Inject the test database into the models
  setTestDatabase(testDb);
  
  return testDb;
}

export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call initTestDb() first.');
  }
  return testDb;
}

export function closeTestDb() {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

export function cleanupTestDb() {
  const db = getTestDb();
  // Disable foreign key checks temporarily for cleanup
  db.exec('PRAGMA foreign_keys = OFF');
  // Delete all tables (order doesn't matter with FKs disabled)
  db.exec('DELETE FROM surgical_reports');
  db.exec('DELETE FROM or_team');
  db.exec('DELETE FROM or_schedules');
  db.exec('DELETE FROM iot_telemetry');
  db.exec('DELETE FROM nursing_notes');
  db.exec('DELETE FROM admissions');
  db.exec('DELETE FROM ward_beds');
  db.exec('DELETE FROM lab_results');
  db.exec('DELETE FROM lab_tests');
  db.exec('DELETE FROM imaging_orders');
  db.exec('DELETE FROM imaging_reports');
  db.exec('DELETE FROM pharmacy_dispensing');
  db.exec('DELETE FROM pharmacy_inventory');
  db.exec('DELETE FROM invoices');
  db.exec('DELETE FROM prescriptions');
  db.exec('DELETE FROM consultations');
  db.exec('DELETE FROM medical_history');
  db.exec('DELETE FROM visits');
  db.exec('DELETE FROM patient_doctor');
  db.exec('DELETE FROM department_requests');
  db.exec('DELETE FROM documents');
  db.exec('DELETE FROM patients');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM personnel');
  db.exec('DELETE FROM departments');
  db.exec('DELETE FROM roles');
  db.exec('DELETE FROM permissions');
  db.exec('DELETE FROM role_permissions');
  db.exec('DELETE FROM wards');
  db.exec('DELETE FROM rooms');
  // Reset auto-increment counters
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'patients', 'visits', 'admissions', 'consultations', 'prescriptions', 'invoices', 'lab_tests', 'lab_results', 'imaging_orders', 'imaging_reports', 'or_schedules', 'or_team', 'surgical_reports', 'iot_telemetry', 'nursing_notes', 'ward_beds', 'pharmacy_dispensing', 'pharmacy_inventory', 'medical_history', 'department_requests', 'documents', 'personnel', 'departments', 'roles', 'permissions', 'role_permissions', 'wards', 'rooms', 'surgical_reports', 'or_team', 'or_schedules')");
  // Re-enable foreign key checks
  db.exec('PRAGMA foreign_keys = ON');
  // Force WAL checkpoint to ensure changes are visible to other connections
  db.exec('PRAGMA wal_checkpoint(FULL)');
}

export { initTestDb as getTestDbInstance };