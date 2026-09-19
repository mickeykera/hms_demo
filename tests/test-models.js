import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use test database file (from DB_PATH env var) or in-memory as fallback
const testDbPath = process.env.DB_PATH || ':memory:';
const testDb = new DatabaseSync(testDbPath);

testDb.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

const schemaPath = join(__dirname, '..', 'src', 'config', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
testDb.exec(schema);

export function getTestDbInstance() {
  return testDb;
}

export function cleanupTestDb() {
  testDb.exec('PRAGMA foreign_keys = OFF');
  testDb.exec('DELETE FROM users');
  testDb.exec('DELETE FROM patients');
  testDb.exec('DELETE FROM visits');
  testDb.exec('DELETE FROM medical_history');
  testDb.exec('DELETE FROM consultations');
  testDb.exec('DELETE FROM prescriptions');
  testDb.exec('DELETE FROM invoices');
  testDb.exec('DELETE FROM lab_tests');
  testDb.exec('DELETE FROM lab_results');
  testDb.exec('DELETE FROM imaging_orders');
  testDb.exec('DELETE FROM imaging_reports');
  testDb.exec('DELETE FROM ward_beds');
  testDb.exec('DELETE FROM admissions');
  testDb.exec('DELETE FROM nursing_notes');
  testDb.exec('DELETE FROM iot_telemetry');
  testDb.exec('DELETE FROM or_schedules');
  testDb.exec('DELETE FROM or_team');
  testDb.exec('DELETE FROM surgical_reports');
  testDb.exec('DELETE FROM pharmacy_inventory');
  testDb.exec('DELETE FROM pharmacy_dispensing');
  testDb.exec('DELETE FROM medications');
  testDb.exec('DELETE FROM department_requests');
  testDb.exec('DELETE FROM documents');
  testDb.exec('DELETE FROM personnel');
  testDb.exec('DELETE FROM departments');
  testDb.exec('DELETE FROM roles');
  testDb.exec('DELETE FROM permissions');
  testDb.exec('DELETE FROM role_permissions');
  testDb.exec('DELETE FROM wards');
  testDb.exec('DELETE FROM rooms');
  testDb.exec('DELETE FROM request_templates');
  testDb.exec('DELETE FROM sla_configs');
  testDb.exec('DELETE FROM request_escalations');
  testDb.exec('DELETE FROM workflow_definitions');
  testDb.exec('DELETE FROM workflow_instances');
  testDb.exec("DELETE FROM sqlite_sequence");
  testDb.exec('PRAGMA foreign_keys = ON');
  testDb.exec('PRAGMA wal_checkpoint(FULL)');
}

export function generateGlobalId() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `HMS-${ts}-${rand}`;
}

export function generateInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${ts}-${rand}`;
}

export function createUser(user) {
  return testDb.prepare(
    'INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)'
  ).run(user.username, user.password_hash, user.full_name, user.role, user.department || null);
}

export function getUserByUsername(username) {
  return testDb.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return testDb.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function createPatient(patient) {
  return testDb.prepare(
    `INSERT INTO patients (global_id, first_name, last_name, date_of_birth, gender, blood_type, email, phone, address, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_id, insurance_validity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    patient.global_id, patient.first_name, patient.last_name, patient.date_of_birth,
    patient.gender, patient.blood_type || null, patient.email || null, patient.phone, patient.address || null,
    patient.emergency_contact_name || null, patient.emergency_contact_phone || null,
    patient.insurance_provider || null, patient.insurance_id || null, patient.insurance_validity || null
  );
}

export function getPatientByGlobalId(globalId) {
  return testDb.prepare('SELECT * FROM patients WHERE global_id = ?').get(globalId);
}

export function getPatientById(id) {
  return testDb.prepare('SELECT * FROM patients WHERE id = ?').get(id);
}

export function updatePatient(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  return testDb.prepare(`UPDATE patients SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
}

export function createVisit(visit) {
  return testDb.prepare(
    'INSERT INTO visits (patient_id, visit_type, triage_priority, queue_position, department) VALUES (?, ?, ?, ?, ?)'
  ).run(visit.patient_id, visit.visit_type, visit.triage_priority, visit.queue_position, visit.department);
}

export function getPatientVisits(patientId) {
  return testDb.prepare('SELECT * FROM visits WHERE patient_id = ? ORDER BY check_in_time DESC').all(patientId);
}

export function getVisitById(id) {
  return testDb.prepare('SELECT * FROM visits WHERE id = ?').get(id);
}

export function getNextQueuePosition(department) {
  const row = testDb.prepare('SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_pos FROM visits WHERE department = ? AND status = ?').get(department, 'Waiting');
  return row ? row.next_pos : 1;
}

export function getWaitingPatients(department) {
  return testDb.prepare('SELECT * FROM visits WHERE department = ? AND status = ? ORDER BY triage_priority ASC, queue_position ASC').all(department, 'Waiting');
}

export function updateVisitStatus(id, status) {
  return testDb.prepare('UPDATE visits SET status = ? WHERE id = ?').run(status, id);
}

export function createMedicalHistory(entry) {
  return testDb.prepare('INSERT INTO medical_history (patient_id, condition, diagnosis_date, treatment, status, notes) VALUES (?, ?, ?, ?, ?, ?)').run(
    entry.patient_id, entry.condition, entry.diagnosis_date, entry.treatment, entry.status, entry.notes
  );
}

export function getMedicalHistory(patientId) {
  return testDb.prepare('SELECT * FROM medical_history WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
}

export function createConsultation(consultation) {
  return testDb.prepare(
    'INSERT INTO consultations (visit_id, patient_id, doctor_id, chief_complaint, diagnosis, treatment_plan, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    consultation.visit_id, consultation.patient_id, consultation.doctor_id,
    consultation.chief_complaint, consultation.diagnosis, consultation.treatment_plan, consultation.notes
  );
}

export function getConsultationsByPatient(patientId) {
  return testDb.prepare('SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date DESC').all(patientId);
}

export function createPrescription(prescription) {
  return testDb.prepare(
    'INSERT INTO prescriptions (consultation_id, patient_id, medication_name, dosage, frequency, duration_days, instructions, prescribing_doctor_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    prescription.consultation_id, prescription.patient_id, prescription.medication_name,
    prescription.dosage, prescription.frequency, prescription.duration_days,
    prescription.instructions || null, prescription.prescribing_doctor_id, 'ORDERED'
  );
}

export function getPrescriptionsByPatient(patientId) {
  return testDb.prepare('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
}

export function createInvoice(invoice) {
  const stmt = testDb.prepare('INSERT INTO invoices (patient_id, visit_id, invoice_number, total_amount, balance, insurance_applicable) VALUES (?, ?, ?, ?, ?, ?)');
  return stmt.run(invoice.patient_id, invoice.visit_id, invoice.invoice_number, invoice.total_amount, invoice.total_amount, invoice.insurance_applicable);
}

export function getInvoiceById(id) {
  return testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
}

export function getInvoicesByPatient(patientId) {
  return testDb.prepare('SELECT * FROM invoices WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
}

export function updateInvoiceStatus(id, status, paidAmount) {
  const row = testDb.prepare('SELECT total_amount FROM invoices WHERE id = ?').get(id);
  const total = row ? row.total_amount : 0;
  const newStatus = paidAmount >= total ? 'Paid' : 'Partial';
  return testDb.prepare('UPDATE invoices SET paid_amount = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(paidAmount, total - paidAmount, newStatus, id);
}

export function createLabTest(test) {
  return testDb.prepare('INSERT INTO lab_tests (patient_id, order_doctor_id, test_name, test_type, sample_id) VALUES (?, ?, ?, ?, ?)').run(
    test.patient_id, test.order_doctor_id, test.test_name, test.test_type, test.sample_id
  );
}

export function getLabTestsByPatient(patientId) {
  return testDb.prepare('SELECT * FROM lab_tests WHERE patient_id = ? ORDER BY ordered_at DESC').all(patientId);
}

export function updateLabTestStatus(id, status) {
  return testDb.prepare('UPDATE lab_tests SET status = ?, completed_at = CASE WHEN ? = ? THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?').run(status, status, 'Completed', id);
}

export function createLabResult(result) {
  return testDb.prepare('INSERT INTO lab_results (lab_test_id, result_data, reference_range, flagged, lab_tech_id) VALUES (?, ?, ?, ?, ?)').run(
    result.lab_test_id, result.result_data, result.reference_range, result.flagged, result.lab_tech_id
  );
}

export function getLabResultsByTest(labTestId) {
  return testDb.prepare('SELECT * FROM lab_results WHERE lab_test_id = ?').all(labTestId);
}

export function createWardBed(bed) {
  return testDb.prepare('INSERT INTO ward_beds (ward_name, bed_number, bed_type, status) VALUES (?, ?, ?, ?)').run(bed.ward_name, bed.bed_number, bed.bed_type, bed.status);
}

export function getAvailableBeds() {
  return testDb.prepare("SELECT * FROM ward_beds WHERE status = 'Available' ORDER BY ward_name, bed_number").all();
}

export function getBedById(id) {
  return testDb.prepare('SELECT * FROM ward_beds WHERE id = ?').get(id);
}

export function updateBedStatus(id, status, patientId) {
  return testDb.prepare("UPDATE ward_beds SET status = ?, patient_id = ?, admitted_at = CASE WHEN ? = 'Occupied' THEN CURRENT_TIMESTAMP ELSE admitted_at END WHERE id = ?").run(status, patientId || null, status, id);
}

export function createAdmission(admission) {
  return testDb.prepare('INSERT INTO admissions (patient_id, bed_id, reason, status, admitting_doctor_id) VALUES (?, ?, ?, ?, ?)').run(
    admission.patient_id, admission.bed_id, admission.reason, admission.status, admission.admitting_doctor_id
  );
}

export function getAdmissionsByPatient(patientId) {
  return testDb.prepare('SELECT * FROM admissions WHERE patient_id = ? ORDER BY admission_date DESC').all(patientId);
}

export function dischargePatient(patientId) {
  return testDb.prepare("UPDATE admissions SET status = 'Discharged', discharge_date = CURRENT_TIMESTAMP WHERE patient_id = ? AND status = 'Admitted'").run(patientId);
}

export function createNursingNote(note) {
  return testDb.prepare('INSERT INTO nursing_notes (admission_id, nurse_id, note_text, vital_signs) VALUES (?, ?, ?, ?)').run(
    note.admission_id, note.nurse_id, note.note_text, note.vital_signs
  );
}

export function getNursingNotes(admissionId) {
  return testDb.prepare('SELECT * FROM nursing_notes WHERE admission_id = ? ORDER BY note_time DESC').all(admissionId);
}

export function createIoTTelemetry(telemetry) {
  return testDb.prepare('INSERT INTO iot_telemetry (patient_id, device_type, device_id, telemetry_data) VALUES (?, ?, ?, ?)').run(
    telemetry.patient_id, telemetry.device_type, telemetry.device_id, telemetry.telemetry_data
  );
}

export function getLatestIoTTelemetry(patientId) {
  return testDb.prepare('SELECT * FROM iot_telemetry WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 50').all(patientId);
}

export function createORSchedule(schedule) {
  return testDb.prepare('INSERT INTO or_schedules (patient_id, procedure_name, scheduled_date, surgeon_id, anesthesiologist_id, prep_complete, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    schedule.patient_id, schedule.procedure_name, schedule.scheduled_date, schedule.surgeon_id,
    schedule.anesthesiologist_id, schedule.prep_complete, schedule.notes
  );
}

export function getORScheduleById(id) {
  return testDb.prepare('SELECT * FROM or_schedules WHERE id = ?').get(id);
}

export function addORTeamMember(scheduleId, memberId, role) {
  return testDb.prepare('INSERT INTO or_team (schedule_id, member_id, role) VALUES (?, ?, ?)').run(scheduleId, memberId, role);
}

export function getORTeam(scheduleId) {
  return testDb.prepare('SELECT t.* FROM or_team t JOIN users u ON t.member_id = u.id WHERE t.schedule_id = ?').all(scheduleId);
}

export function createSurgicalReport(report) {
  testDb.prepare('INSERT INTO surgical_reports (schedule_id, procedure_notes, complications, outcome, surgeon_notes, post_op_care_instructions) VALUES (?, ?, ?, ?, ?, ?)').run(
    report.schedule_id, report.procedure_notes, report.complications, report.outcome,
    report.surgeon_notes, report.post_op_care_instructions
  );
  testDb.prepare('UPDATE or_schedules SET status = ? WHERE id = ?').run('Completed', report.schedule_id);
}

export function updateORScheduleStatus(id, status) {
  return testDb.prepare('UPDATE or_schedules SET status = ? WHERE id = ?').run(status, id);
}