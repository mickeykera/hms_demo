import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Allow injecting a custom database for testing
let db = null;

export function setTestDatabase(testDb) {
  db = testDb;
}

function getOrCreateDb() {
  if (db) return db;
  
  const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'hospital.db');
  console.log('Server using database:', dbPath);
  db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
  
  const schemaPath = join(__dirname, '..', 'config', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  
  const prescriptionColumns = db.prepare('PRAGMA table_info(prescriptions)').all().map(column => column.name);
  const compatibilityColumns = [
    ['status', "TEXT DEFAULT 'ORDERED'"],
    ['rejection_reason', 'TEXT'],
    ['dispensed', 'BOOLEAN DEFAULT 0'],
    ['dispensed_at', 'DATETIME'],
    ['dispensed_by', 'INTEGER'],
  ];
  for (const [name, definition] of compatibilityColumns) {
    if (!prescriptionColumns.includes(name)) {
      db.exec(`ALTER TABLE prescriptions ADD COLUMN ${name} ${definition}`);
    }
  }
  
  // Add personnel_id column to users table if not exists
  const userColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
  if (!userColumns.includes('personnel_id')) {
    db.exec('ALTER TABLE users ADD COLUMN personnel_id INTEGER');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_personnel ON users(personnel_id)');
  }
  
  return db;
}

export function getDb() {
  return getOrCreateDb();
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function createUser(user) {
  return db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)'
  ).run(user.username, user.password_hash, user.full_name, user.role, user.department);
}

export function createPatient(patient) {
  const toNull = (v) => (v === undefined ? null : v);
  return db.prepare(
    `INSERT INTO patients (global_id, first_name, last_name, date_of_birth, gender, blood_type, email, phone, address, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_id, insurance_validity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    patient.global_id, patient.first_name, patient.last_name, patient.date_of_birth,
    patient.gender, toNull(patient.blood_type), toNull(patient.email), patient.phone, toNull(patient.address),
    toNull(patient.emergency_contact_name), toNull(patient.emergency_contact_phone),
    toNull(patient.insurance_provider), toNull(patient.insurance_id), toNull(patient.insurance_validity)
  );
}

export function getPatientByGlobalId(globalId) {
  return db.prepare('SELECT * FROM patients WHERE global_id = ?').get(globalId);
}

export function getPatientById(id) {
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
}

export function updatePatient(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  return db.prepare(`UPDATE patients SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
}

export function createVisit(visit) {
  return db.prepare(
    'INSERT INTO visits (patient_id, visit_type, triage_priority, queue_position, department) VALUES (?, ?, ?, ?, ?)'
  ).run(visit.patient_id, visit.visit_type, visit.triage_priority, visit.queue_position, visit.department);
}

export function getPatientVisits(patientId) {
  return db.prepare('SELECT * FROM visits WHERE patient_id = ? ORDER BY check_in_time DESC').all(patientId);
}

export function getVisitById(id) {
  return db.prepare('SELECT * FROM visits WHERE id = ?').get(id);
}

export function getNextQueuePosition(department) {
  const row = db.prepare('SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_pos FROM visits WHERE department = ? AND status = ?').get(department, 'Waiting');
  return row ? row.next_pos : 1;
}

export function getWaitingPatients(department) {
  return db.prepare('SELECT * FROM visits WHERE department = ? AND status = ? ORDER BY triage_priority ASC, queue_position ASC').all(department, 'Waiting');
}

export function updateVisitStatus(id, status) {
  return db.prepare('UPDATE visits SET status = ? WHERE id = ?').run(status, id);
}

export function createMedicalHistory(entry) {
  return db.prepare('INSERT INTO medical_history (patient_id, condition, diagnosis_date, treatment, status, notes) VALUES (?, ?, ?, ?, ?, ?)').run(
    entry.patient_id, entry.condition, entry.diagnosis_date, entry.treatment, entry.status, entry.notes
  );
}

export function getMedicalHistory(patientId) {
  return db.prepare('SELECT * FROM medical_history WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
}

export function createConsultation(consultation) {
  return db.prepare(
    'INSERT INTO consultations (visit_id, patient_id, doctor_id, chief_complaint, diagnosis, treatment_plan, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    consultation.visit_id, consultation.patient_id, consultation.doctor_id,
    consultation.chief_complaint, consultation.diagnosis, consultation.treatment_plan, consultation.notes
  );
}

export function getConsultationsByPatient(patientId) {
  return db.prepare('SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date DESC').all(patientId);
}

export function createPrescription(prescription) {
  return db.prepare(
    'INSERT INTO prescriptions (consultation_id, patient_id, medication_name, dosage, frequency, duration_days, instructions, prescribing_doctor_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    prescription.consultation_id, prescription.patient_id, prescription.medication_name,
    prescription.dosage, prescription.frequency, prescription.duration_days,
    prescription.instructions || null, prescription.prescribing_doctor_id, 'ORDERED'
  );
}

export function getPrescriptionsByPatient(patientId) {
  return db.prepare('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
}

export function createInvoice(invoice) {
  const stmt = db.prepare('INSERT INTO invoices (patient_id, visit_id, invoice_number, total_amount, paid_amount, balance, insurance_applicable) VALUES (?, ?, ?, ?, 0, ?, ?)');
  return stmt.run(invoice.patient_id, invoice.visit_id, invoice.invoice_number, invoice.total_amount, invoice.total_amount, invoice.insurance_applicable ? 1 : 0);
}

export function getInvoiceById(id) {
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
}

export function getInvoicesByPatient(patientId) {
  return db.prepare('SELECT * FROM invoices WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
}

export function updateInvoiceStatus(id, status, paidAmount) {
  const row = db.prepare('SELECT total_amount FROM invoices WHERE id = ?').get(id);
  const total = row ? row.total_amount : 0;
  const newStatus = paidAmount >= total ? 'Paid' : 'Partial';
  return db.prepare('UPDATE invoices SET paid_amount = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(paidAmount, total - paidAmount, newStatus, id);
}

export function createLabTest(test) {
  return db.prepare('INSERT INTO lab_tests (patient_id, order_doctor_id, test_name, test_type, sample_id) VALUES (?, ?, ?, ?, ?)').run(
    test.patient_id, test.order_doctor_id, test.test_name, test.test_type, test.sample_id
  );
}

export function getLabTestsByPatient(patientId) {
  return db.prepare('SELECT * FROM lab_tests WHERE patient_id = ? ORDER BY ordered_at DESC').all(patientId);
}

export function getLabTestById(id) {
  return db.prepare('SELECT * FROM lab_tests WHERE id = ?').get(id);
}

export function updateLabTestStatus(id, status) {
  return db.prepare('UPDATE lab_tests SET status = ?, completed_at = CASE WHEN ? IN (?, ?) THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?').run(status, status, 'Completed', 'Verified', id);
}

export function createLabResult(result) {
  return db.prepare('INSERT INTO lab_results (lab_test_id, result_data, reference_range, flagged, lab_tech_id) VALUES (?, ?, ?, ?, ?)').run(
    result.lab_test_id, 
    result.result_data, 
    result.reference_range || null, 
    result.flagged ? 1 : 0,
    result.lab_tech_id
  );
}

export function getLabResultsByTest(labTestId) {
  return db.prepare('SELECT * FROM lab_results WHERE lab_test_id = ?').all(labTestId);
}

export function createWardBed(bed) {
  return db.prepare('INSERT INTO ward_beds (ward_name, bed_number, bed_type, status) VALUES (?, ?, ?, ?)').run(bed.ward_name, bed.bed_number, bed.bed_type, bed.status);
}

export function getAvailableBeds() {
  return db.prepare("SELECT * FROM ward_beds WHERE status = 'Available' ORDER BY ward_name, bed_number").all();
}

export function getBedById(id) {
  return db.prepare('SELECT * FROM ward_beds WHERE id = ?').get(id);
}

export function updateBedStatus(id, status, patientId) {
  return db.prepare("UPDATE ward_beds SET status = ?, patient_id = ?, admitted_at = CASE WHEN ? = 'Occupied' THEN CURRENT_TIMESTAMP ELSE admitted_at END WHERE id = ?").run(status, patientId || null, status, id);
}

export function createAdmission(admission) {
  return db.prepare('INSERT INTO admissions (patient_id, bed_id, reason, status, admitting_doctor_id) VALUES (?, ?, ?, ?, ?)').run(
    admission.patient_id, admission.bed_id, admission.reason, admission.status, admission.admitting_doctor_id
  );
}

export function getAdmissionsByPatient(patientId) {
  return db.prepare('SELECT * FROM admissions WHERE patient_id = ? ORDER BY admission_date DESC').all(patientId);
}

export function dischargePatient(patientId) {
  return db.prepare("UPDATE admissions SET status = 'Discharged', discharge_date = CURRENT_TIMESTAMP WHERE patient_id = ? AND status = 'Admitted'").run(patientId);
}

export function createNursingNote(note) {
  return db.prepare('INSERT INTO nursing_notes (admission_id, nurse_id, note_text, vital_signs) VALUES (?, ?, ?, ?)').run(
    note.admission_id, note.nurse_id, note.note_text, note.vital_signs
  );
}

export function getNursingNotes(admissionId) {
  return db.prepare('SELECT * FROM nursing_notes WHERE admission_id = ? ORDER BY note_time DESC').all(admissionId);
}

export function createIoTTelemetry(telemetry) {
  return db.prepare('INSERT INTO iot_telemetry (patient_id, device_type, device_id, telemetry_data) VALUES (?, ?, ?, ?)').run(
    telemetry.patient_id, telemetry.device_type, telemetry.device_id, telemetry.telemetry_data
  );
}

export function getLatestIoTTelemetry(patientId) {
  return db.prepare('SELECT * FROM iot_telemetry WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 50').all(patientId);
}

export function createORSchedule(schedule) {
  return db.prepare('INSERT INTO or_schedules (patient_id, procedure_name, scheduled_date, surgeon_id, anesthesiologist_id, prep_complete, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    schedule.patient_id, schedule.procedure_name, schedule.scheduled_date, schedule.surgeon_id,
    schedule.anesthesiologist_id ?? null, schedule.prep_complete ?? 0, schedule.notes ?? null
  );
}

export function getORScheduleById(id) {
  return db.prepare('SELECT * FROM or_schedules WHERE id = ?').get(id);
}

export function addORTeamMember(scheduleId, memberId, role) {
  return db.prepare('INSERT INTO or_team (schedule_id, member_id, role) VALUES (?, ?, ?)').run(scheduleId, memberId, role);
}

export function getORTeam(scheduleId) {
  return db.prepare('SELECT t.* FROM or_team t JOIN users u ON t.member_id = u.id WHERE t.schedule_id = ?').all(scheduleId);
}

export function createSurgicalReport(report) {
  return db.prepare('INSERT INTO surgical_reports (schedule_id, procedure_notes, complications, outcome, surgeon_notes, post_op_care_instructions) VALUES (?, ?, ?, ?, ?, ?)').run(
    report.schedule_id, report.procedure_notes, report.complications, report.outcome,
    report.surgeon_notes, report.post_op_care_instructions
  );
}

export function generateGlobalId() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `HMS-${ts}-${rand}`;
}

export function updateORScheduleStatus(id, status) {
  return db.prepare('UPDATE or_schedules SET status = ? WHERE id = ?').run(status, id);
}

export function generateInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  return `INV-${ts}`;
}

// Notifications
export function createNotification(data) {
  return db.prepare(
    'INSERT INTO notifications (recipient_id, type, title, message, related_entity, related_entity_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(data.recipient_id, data.type, data.title, data.message, data.related_entity, data.related_entity_id);
}

export function getNotifications(userId, unreadOnly = false) {
  if (unreadOnly) {
    return db.prepare('SELECT * FROM notifications WHERE recipient_id = ? AND is_read = 0 ORDER BY created_at DESC').all(userId);
  }
  return db.prepare('SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50').all(userId);
}

export function markNotificationAsRead(notificationId) {
  return db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ?').run(notificationId);
}

export function markAllNotificationsAsRead(userId) {
  return db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE recipient_id = ? AND is_read = 0').run(userId);
}

// Audit Logs
export function createAuditLog(data) {
  return db.prepare(
    'INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(data.actor_id, data.action, data.resource_type, data.resource_id, data.details, data.ip_address);
}

export function getAuditLogs(filters = {}, limit = 100) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.actor_id) {
    query += ' AND actor_id = ?';
    params.push(filters.actor_id);
  }
  if (filters.resource_type) {
    query += ' AND resource_type = ?';
    params.push(filters.resource_type);
  }
  if (filters.action) {
    query += ' AND action = ?';
    params.push(filters.action);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params);
}

// Messaging
export function createConversation(participant1Id, participant2Id, patientId = null) {
  const result = db.prepare(
    'INSERT INTO conversations (participant1_id, participant2_id, patient_id) VALUES (?, ?, ?)'
  ).run(participant1Id, participant2Id, patientId);
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
}

export function getConversation(userId1, userId2) {
  return db.prepare(
    'SELECT * FROM conversations WHERE (participant1_id = ? AND participant2_id = ?) OR (participant1_id = ? AND participant2_id = ?) ORDER BY updated_at DESC LIMIT 1'
  ).get(userId1, userId2, userId2, userId1);
}

export function getUserConversations(userId) {
  return db.prepare(
    'SELECT * FROM conversations WHERE participant1_id = ? OR participant2_id = ? ORDER BY updated_at DESC'
  ).all(userId, userId);
}

export function sendMessage(conversationId, senderId, content) {
  return db.prepare(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)'
  ).run(conversationId, senderId, content);
}

export function getConversationMessages(conversationId, limit = 50) {
  return db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(conversationId, limit);
}

// Departments
export function createDepartment(dept) {
  return db.prepare('INSERT INTO departments (name, code, description, parent_department_id) VALUES (?, ?, ?, ?)')
    .run(dept.name, dept.code, dept.description || null, dept.parent_department_id || null);
}

export function getDepartmentById(id) {
  return db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
}

export function getDepartmentByCode(code) {
  return db.prepare('SELECT * FROM departments WHERE code = ?').get(code);
}

export function getAllDepartments() {
  return db.prepare('SELECT * FROM departments WHERE active = 1 ORDER BY name').all();
}

export function updateDepartment(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  return db.prepare(`UPDATE departments SET ${fields} WHERE id = ?`).run(...values);
}

// Roles
export function createRole(role) {
  return db.prepare('INSERT INTO roles (name, display_name, description, hierarchy_level) VALUES (?, ?, ?, ?)')
    .run(role.name, role.display_name, role.description || null, role.hierarchy_level || 1);
}

export function getRoleById(id) {
  return db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
}

export function getRoleByName(name) {
  return db.prepare('SELECT * FROM roles WHERE name = ?').get(name);
}

export function getAllRoles() {
  return db.prepare('SELECT * FROM roles WHERE active = 1 ORDER BY hierarchy_level DESC').all();
}

export function assignPermissionToRole(roleId, permissionId) {
  return db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(roleId, permissionId);
}

export function removePermissionFromRole(roleId, permissionId) {
  return db.prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?').run(roleId, permissionId);
}

export function getPermissionsForRoleName(roleName) {
  return db.prepare(
    `SELECT p.name, p.display_name, p.category FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN roles r ON rp.role_id = r.id
     WHERE r.name = ?`
  ).all(roleName);
}

// Permissions
export function createPermission(perm) {
  return db.prepare('INSERT INTO permissions (name, display_name, description, category) VALUES (?, ?, ?, ?)')
    .run(perm.name, perm.display_name, perm.description || null, perm.category);
}

export function getAllPermissions() {
  return db.prepare('SELECT * FROM permissions ORDER BY category, name').all();
}

export function getPermissionsByCategory(category) {
  return db.prepare('SELECT * FROM permissions WHERE category = ? ORDER BY name').all(category);
}

// Personnel
export function createPersonnel(personnel) {
  return db.prepare(
    `INSERT INTO personnel (employee_id, user_id, first_name, last_name, middle_name, email, phone, address, date_of_birth, gender, hire_date, employment_status, professional_title, license_number, license_expiry, department_id, role_id, supervisor_id, work_schedule, emergency_contact_name, emergency_contact_phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    personnel.employee_id, personnel.user_id || null, personnel.first_name, personnel.last_name,
    personnel.middle_name || null, personnel.email || null, personnel.phone || null,
    personnel.address || null, personnel.date_of_birth || null, personnel.gender || null,
    personnel.hire_date, personnel.employment_status || 'Active', personnel.professional_title || null,
    personnel.license_number || null, personnel.license_expiry || null,
    personnel.department_id || null, personnel.role_id || null, personnel.supervisor_id || null,
    personnel.work_schedule || null, personnel.emergency_contact_name || null, personnel.emergency_contact_phone || null
  );
}

export function getPersonnelById(id) {
  return db.prepare('SELECT * FROM personnel WHERE id = ?').get(id);
}

export function getPersonnelByUserId(userId) {
  return db.prepare('SELECT * FROM personnel WHERE user_id = ?').get(userId);
}

export function getPersonnelByEmployeeId(employeeId) {
  return db.prepare('SELECT * FROM personnel WHERE employee_id = ?').get(employeeId);
}

export function getAllPersonnel(filters = {}) {
  let query = 'SELECT p.*, d.name as department_name, r.name as role_name FROM personnel p LEFT JOIN departments d ON p.department_id = d.id LEFT JOIN roles r ON p.role_id = r.id WHERE 1=1';
  const params = [];
  if (filters.department_id) {
    query += ' AND p.department_id = ?';
    params.push(filters.department_id);
  }
  if (filters.role_id) {
    query += ' AND p.role_id = ?';
    params.push(filters.role_id);
  }
  if (filters.employment_status) {
    query += ' AND p.employment_status = ?';
    params.push(filters.employment_status);
  }
  query += ' ORDER BY p.last_name, p.first_name';
  return db.prepare(query).all(...params);
}

export function updatePersonnel(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  return db.prepare(`UPDATE personnel SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
}

// Patient-Doctor Assignment
export function assignDoctorToPatient(assignment) {
  return db.prepare(
    'INSERT OR IGNORE INTO patient_doctor (patient_id, doctor_id, assignment_type, assigned_by) VALUES (?, ?, ?, ?)'
  ).run(assignment.patient_id, assignment.doctor_id, assignment.assignment_type || 'Primary', assignment.assigned_by || null);
}

export function removeDoctorFromPatient(patientId, doctorId, assignmentType = 'Primary') {
  return db.prepare('UPDATE patient_doctor SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE patient_id = ? AND doctor_id = ? AND assignment_type = ?').run(patientId, doctorId, assignmentType);
}

export function getPatientDoctors(patientId) {
  return db.prepare(
    `SELECT pd.*, u.full_name as doctor_name, u.username as doctor_username, u.email as doctor_email
     FROM patient_doctor pd JOIN users u ON pd.doctor_id = u.id
     WHERE pd.patient_id = ? AND pd.active = 1 ORDER BY pd.assigned_at DESC`
  ).all(patientId);
}

export function getDoctorPatients(doctorId) {
  return db.prepare(
    `SELECT pd.*, p.first_name, p.last_name, p.global_id, p.date_of_birth, p.gender, p.phone
     FROM patient_doctor pd JOIN patients p ON pd.patient_id = p.id
     WHERE pd.doctor_id = ? AND pd.active = 1 ORDER BY pd.assigned_at DESC`
  ).all(doctorId);
}

export function isDoctorAssignedToPatient(doctorId, patientId) {
  return db.prepare('SELECT 1 FROM patient_doctor WHERE doctor_id = ? AND patient_id = ? AND active = 1').get(doctorId, patientId);
}

// Department Requests
export function createDepartmentRequest(request) {
  const requestNumber = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return db.prepare(
    `INSERT INTO department_requests (request_number, requesting_user_id, requesting_department_id, receiving_department_id, patient_id, request_type, priority, clinical_details, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(requestNumber, request.requesting_user_id, request.requesting_department_id, request.receiving_department_id, request.patient_id, request.request_type, request.priority || 'Routine', request.clinical_details || null, request.notes || null);
}

export function getDepartmentRequestById(id) {
  return db.prepare('SELECT * FROM department_requests WHERE id = ?').get(id);
}

export function getDepartmentRequests(filters = {}) {
  let query = 'SELECT dr.*, p.first_name, p.last_name, p.global_id, rd.name as requesting_dept, rv.name as receiving_dept, u.full_name as requester_name FROM department_requests dr JOIN patients p ON dr.patient_id = p.id JOIN departments rd ON dr.requesting_department_id = rd.id JOIN departments rv ON dr.receiving_department_id = rv.id LEFT JOIN users u ON dr.requesting_user_id = u.id WHERE 1=1';
  const params = [];
  if (filters.patient_id) {
    query += ' AND dr.patient_id = ?';
    params.push(filters.patient_id);
  }
  if (filters.receiving_department_id) {
    query += ' AND dr.receiving_department_id = ?';
    params.push(filters.receiving_department_id);
  }
  if (filters.requesting_department_id) {
    query += ' AND dr.requesting_department_id = ?';
    params.push(filters.requesting_department_id);
  }
  if (filters.status) {
    query += ' AND dr.status = ?';
    params.push(filters.status);
  }
  if (filters.request_type) {
    query += ' AND dr.request_type = ?';
    params.push(filters.request_type);
  }
  query += ' ORDER BY dr.requested_at DESC';
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  return db.prepare(query).all(...params);
}

export function updateDepartmentRequestStatus(id, status, userId = null) {
  const timestampField = {
    'Accepted': 'accepted_at',
    'InProgress': 'started_at',
    'Completed': 'completed_at',
    'Verified': 'verified_at',
    'Cancelled': 'completed_at',
    'Rejected': 'completed_at'
  }[status];
  let query = 'UPDATE department_requests SET status = ?';
  const params = [status];
  if (timestampField) {
    query += `, ${timestampField} = CURRENT_TIMESTAMP`;
  }
  if (userId && (status === 'Completed' || status === 'Verified')) {
    query += ', completed_by = ?';
    params.push(userId);
  }
  if (userId && status === 'Verified') {
    query += ', verified_by = ?';
    params.push(userId);
  }
  query += ' WHERE id = ?';
  params.push(id);
  return db.prepare(query).run(...params);
}

export function updateDepartmentRequestResult(id, resultData, resultNotes, userId) {
  return db.prepare('UPDATE department_requests SET result_data = ?, result_notes = ?, completed_by = ?, status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run(resultData, resultNotes, userId, 'Completed', id);
}

// Request Templates
export function createRequestTemplate(template) {
  return db.prepare(
    `INSERT INTO request_templates (name, description, request_type, default_priority, clinical_details_template, notes_template, receiving_department_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(template.name, template.description || null, template.request_type, template.default_priority || 'Routine', template.clinical_details_template || null, template.notes_template || null, template.receiving_department_id, template.created_by);
}

export function getRequestTemplates(filters = {}) {
  let query = 'SELECT rt.*, d.name as receiving_dept_name, u.full_name as created_by_name FROM request_templates rt JOIN departments d ON rt.receiving_department_id = d.id LEFT JOIN users u ON rt.created_by = u.id WHERE 1=1';
  const params = [];
  if (filters.request_type) {
    query += ' AND rt.request_type = ?';
    params.push(filters.request_type);
  }
  if (filters.receiving_department_id) {
    query += ' AND rt.receiving_department_id = ?';
    params.push(filters.receiving_department_id);
  }
  query += ' ORDER BY rt.name';
  return db.prepare(query).all(...params);
}

export function getRequestTemplateById(id) {
  return db.prepare('SELECT * FROM request_templates WHERE id = ?').get(id);
}

export function updateRequestTemplate(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  return db.prepare(`UPDATE request_templates SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
}

export function deleteRequestTemplate(id) {
  return db.prepare('DELETE FROM request_templates WHERE id = ?').run(id);
}

// SLA Configuration
export function createSLAConfig(config) {
  return db.prepare(
    `INSERT INTO sla_configs (request_type, priority, receiving_department_id, response_time_minutes, resolution_time_minutes, escalation_time_minutes, escalation_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(config.request_type, config.priority, config.receiving_department_id, config.response_time_minutes, config.resolution_time_minutes, config.escalation_time_minutes || null, config.escalation_user_id || null);
}

export function getSLAConfigs(filters = {}) {
  let query = 'SELECT sc.*, d.name as department_name, u.full_name as escalation_user_name FROM sla_configs sc JOIN departments d ON sc.receiving_department_id = d.id LEFT JOIN users u ON sc.escalation_user_id = u.id WHERE 1=1';
  const params = [];
  if (filters.request_type) {
    query += ' AND sc.request_type = ?';
    params.push(filters.request_type);
  }
  if (filters.receiving_department_id) {
    query += ' AND sc.receiving_department_id = ?';
    params.push(filters.receiving_department_id);
  }
  query += ' ORDER BY sc.request_type, sc.priority';
  return db.prepare(query).all(...params);
}

export function getSLAConfig(requestType, priority, receivingDepartmentId) {
  return db.prepare(
    'SELECT * FROM sla_configs WHERE request_type = ? AND priority = ? AND receiving_department_id = ?'
  ).get(requestType, priority, receivingDepartmentId);
}

// Request Escalations
export function createRequestEscalation(escalation) {
  return db.prepare(
    `INSERT INTO request_escalations (request_id, escalated_to_user_id, escalated_by_user_id, reason, sla_config_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(escalation.request_id, escalation.escalated_to_user_id, escalation.escalated_by_user_id, escalation.reason, escalation.sla_config_id || null);
}

export function getRequestEscalations(requestId) {
  return db.prepare(
    `SELECT re.*, u1.full_name as escalated_to_name, u2.full_name as escalated_by_name
     FROM request_escalations re
     LEFT JOIN users u1 ON re.escalated_to_user_id = u1.id
     LEFT JOIN users u2 ON re.escalated_by_user_id = u2.id
     WHERE re.request_id = ?
     ORDER BY re.created_at DESC`
  ).all(requestId);
}

// Workflow Definitions
export function createWorkflowDefinition(workflow) {
  return db.prepare(
    `INSERT INTO workflow_definitions (name, description, trigger_type, trigger_config, steps, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(workflow.name, workflow.description || null, workflow.trigger_type, JSON.stringify(workflow.trigger_config || {}), JSON.stringify(workflow.steps || []), workflow.created_by);
}

export function getWorkflowDefinitions() {
  return db.prepare('SELECT * FROM workflow_definitions WHERE active = 1 ORDER BY name').all();
}

export function getWorkflowDefinitionById(id) {
  return db.prepare('SELECT * FROM workflow_definitions WHERE id = ?').get(id);
}

// Documents
export function createDocument(doc) {
  return db.prepare(
    `INSERT INTO documents (patient_id, uploaded_by, department_id, document_type, title, file_path, file_name, file_size, mime_type, access_level, parent_document_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(doc.patient_id, doc.uploaded_by, doc.department_id || null, doc.document_type, doc.title, doc.file_path, doc.file_name, doc.file_size || null, doc.mime_type || null, doc.access_level || 'Department', doc.parent_document_id || null);
}

export function getDocumentsByPatient(patientId, accessLevel = null) {
  let query = 'SELECT d.*, u.full_name as uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.patient_id = ?';
  const params = [patientId];
  if (accessLevel) {
    query += ' AND d.access_level = ?';
    params.push(accessLevel);
  }
  query += ' ORDER BY d.created_at DESC';
  return db.prepare(query).all(...params);
}

export function getDocumentById(id) {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

// Wards
export function createWard(ward) {
  return db.prepare('INSERT INTO wards (name, building, floor, ward_type, capacity, nursing_station_phone) VALUES (?, ?, ?, ?, ?, ?)').run(ward.name, ward.building || null, ward.floor || null, ward.ward_type || null, ward.capacity || null, ward.nursing_station_phone || null);
}

export function getWardById(id) {
  return db.prepare('SELECT * FROM wards WHERE id = ?').get(id);
}

export function getAllWards(activeOnly = true) {
  if (activeOnly) {
    return db.prepare('SELECT * FROM wards WHERE active = 1 ORDER BY name').all();
  }
  return db.prepare('SELECT * FROM wards ORDER BY name').all();
}

export function updateWard(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  return db.prepare(`UPDATE wards SET ${fields} WHERE id = ?`).run(...values);
}

// Rooms
export function createRoom(room) {
  return db.prepare('INSERT INTO rooms (ward_id, room_number, room_type, capacity) VALUES (?, ?, ?, ?)').run(room.ward_id, room.room_number, room.room_type || null, room.capacity || 1);
}

export function getRoomsByWard(wardId, activeOnly = true) {
  if (activeOnly) {
    return db.prepare('SELECT * FROM rooms WHERE ward_id = ? AND active = 1 ORDER BY room_number').all(wardId);
  }
  return db.prepare('SELECT * FROM rooms WHERE ward_id = ? ORDER BY room_number').all(wardId);
}

export function getRoomById(id) {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}

export function updateRoom(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  return db.prepare(`UPDATE rooms SET ${fields} WHERE id = ?`).run(...values);
}

// Ward Beds (enhanced)
export function getWardBedsWithDetails(wardId = null) {
  let query = 'SELECT wb.*, w.name as ward_name, p.first_name, p.last_name, p.global_id FROM ward_beds wb JOIN wards w ON wb.ward_name = w.name LEFT JOIN patients p ON wb.patient_id = p.id WHERE 1=1';
  const params = [];
  if (wardId) {
    query += ' AND w.id = ?';
    params.push(wardId);
  }
  query += ' ORDER BY w.name, wb.bed_number';
  return db.prepare(query).all(...params);
}
