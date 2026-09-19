import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTestDbInstance,
  cleanupTestDb,
  generateGlobalId,
  createUser,
  getUserByUsername,
  getUserById,
  createPatient,
  getPatientByGlobalId,
  getPatientById,
  updatePatient,
  createVisit,
  getVisitById,
  getPatientVisits,
  getNextQueuePosition,
  getWaitingPatients,
  updateVisitStatus,
  createMedicalHistory,
  getMedicalHistory,
  createConsultation,
  getConsultationsByPatient,
  createPrescription,
  getPrescriptionsByPatient,
  createInvoice,
  getInvoiceById,
  getInvoicesByPatient,
  updateInvoiceStatus,
  createLabTest,
  getLabTestsByPatient,
  updateLabTestStatus,
  createLabResult,
  getLabResultsByTest,
  createWardBed,
  getAvailableBeds,
  getBedById,
  updateBedStatus,
  createAdmission,
  getAdmissionsByPatient,
  dischargePatient,
  createNursingNote,
  getNursingNotes,
  createIoTTelemetry,
  getLatestIoTTelemetry,
  createORSchedule,
  getORScheduleById,
  addORTeamMember,
  getORTeam,
  createSurgicalReport,
  generateInvoiceNumber,
} from './test-models.js';

describe('Database Models', () => {
  beforeEach(() => {
    cleanupTestDb();
  });

  describe('User Management', () => {
    it('should create a user', () => {
      const result = createUser({
        username: 'testdoctor',
        password_hash: 'hashedpass',
        full_name: 'Test Doctor',
        role: 'Doctor',
        department: 'Cardiology',
      });
      expect(result.lastInsertRowid).toBeDefined();

      const user = getUserByUsername('testdoctor');
      expect(user).toBeDefined();
      expect(user.username).toBe('testdoctor');
      expect(user.role).toBe('Doctor');
      expect(user.department).toBe('Cardiology');
    });

    it('should not create duplicate username', () => {
      createUser({ username: 'duplicate', password_hash: 'pass', full_name: 'User 1', role: 'Doctor' });
      expect(() => createUser({ username: 'duplicate', password_hash: 'pass', full_name: 'User 2', role: 'Nurse' })).toThrow();
    });
  });

  describe('Patient Management', () => {
    it('should generate unique global IDs', () => {
      const id1 = generateGlobalId();
      const id2 = generateGlobalId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^HMS-[A-Z0-9]+-[A-Z0-9]+$/);
    });

    it('should create a patient', () => {
      const globalId = generateGlobalId();
      const result = createPatient({
        global_id: globalId,
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1990-01-15',
        gender: 'Male',
        blood_type: 'O+',
        email: 'john.doe@example.com',
        phone: '555-1234',
        address: '123 Main St',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '555-5678',
        insurance_provider: 'HealthCorp',
        insurance_id: 'HC123456',
        insurance_validity: '2025-12-31',
      });
      expect(result.lastInsertRowid).toBeDefined();

      const patient = getPatientByGlobalId(globalId);
      expect(patient).toBeDefined();
      expect(patient.first_name).toBe('John');
      expect(patient.last_name).toBe('Doe');
      expect(patient.global_id).toBe(globalId);
    });

    it('should get patient by ID', () => {
      const globalId = generateGlobalId();
      const result = createPatient({ global_id: globalId, first_name: 'Jane', last_name: 'Smith', date_of_birth: '1985-05-20', gender: 'Female', phone: '555-9999' });
      const patient = getPatientById(result.lastInsertRowid);
      expect(patient).toBeDefined();
      expect(patient.id).toBe(result.lastInsertRowid);
    });

    it('should update patient', () => {
      const globalId = generateGlobalId();
      createPatient({ global_id: globalId, first_name: 'Bob', last_name: 'Wilson', date_of_birth: '1970-03-10', gender: 'Male', phone: '555-0000' });
      const patient = getPatientByGlobalId(globalId);

      updatePatient(patient.id, { phone: '555-1111', email: 'bob.new@example.com' });
      const updated = getPatientByGlobalId(globalId);
      expect(updated.phone).toBe('555-1111');
      expect(updated.email).toBe('bob.new@example.com');
    });
  });

  describe('Visit Management', () => {
    let patientId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const result = createPatient({ global_id: globalId, first_name: 'Test', last_name: 'Patient', date_of_birth: '1995-01-01', gender: 'Other', phone: '555-2222' });
      patientId = result.lastInsertRowid;
    });

    it('should create a visit', () => {
      const result = createVisit({ patient_id: patientId, visit_type: 'WalkIn', triage_priority: 2, queue_position: 1, department: 'Emergency' });
      expect(result.lastInsertRowid).toBeDefined();

      const visit = getVisitById(result.lastInsertRowid);
      expect(visit).toBeDefined();
      expect(visit.patient_id).toBe(patientId);
      expect(visit.status).toBe('Waiting');
    });

    it('should get patient visits', () => {
      createVisit({ patient_id: patientId, visit_type: 'WalkIn', triage_priority: 3, queue_position: 1, department: 'General' });
      createVisit({ patient_id: patientId, visit_type: 'Scheduled', triage_priority: 2, queue_position: 2, department: 'Cardiology' });
      const visits = getPatientVisits(patientId);
      expect(visits.length).toBe(2);
    });

    it('should get next queue position', () => {
      createVisit({ patient_id: patientId, visit_type: 'WalkIn', triage_priority: 3, queue_position: 1, department: 'General' });
      createVisit({ patient_id: patientId, visit_type: 'WalkIn', triage_priority: 3, queue_position: 2, department: 'General' });
      const nextPos = getNextQueuePosition('General');
      expect(nextPos).toBe(3);
    });

    it('should get waiting patients ordered by priority', () => {
      createVisit({ patient_id: patientId, visit_type: 'WalkIn', triage_priority: 3, queue_position: 1, department: 'General' });
      const p2 = createPatient({ global_id: generateGlobalId(), first_name: 'P2', last_name: 'Test', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-3333' });
      createVisit({ patient_id: p2.lastInsertRowid, visit_type: 'Emergency', triage_priority: 1, queue_position: 1, department: 'General' });
      const waiting = getWaitingPatients('General');
      expect(waiting[0].triage_priority).toBe(1);
    });

    it('should update visit status', () => {
      const result = createVisit({ patient_id: patientId, visit_type: 'WalkIn', triage_priority: 3, queue_position: 1, department: 'General' });
      updateVisitStatus(result.lastInsertRowid, 'InConsultation');
      const visit = getVisitById(result.lastInsertRowid);
      expect(visit.status).toBe('InConsultation');
    });
  });

  describe('Medical History', () => {
    let patientId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const result = createPatient({ global_id: globalId, first_name: 'History', last_name: 'Patient', date_of_birth: '1980-01-01', gender: 'Male', phone: '555-4444' });
      patientId = result.lastInsertRowid;
    });

    it('should create medical history entry', () => {
      createMedicalHistory({ patient_id: patientId, condition: 'Hypertension', diagnosis_date: '2020-01-15', treatment: 'Lisinopril 10mg', status: 'Active', notes: 'Well controlled' });
      const history = getMedicalHistory(patientId);
      expect(history.length).toBe(1);
      expect(history[0].condition).toBe('Hypertension');
    });
  });

  describe('Consultations & Prescriptions', () => {
    let patientId, visitId, doctorId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const pResult = createPatient({ global_id: globalId, first_name: 'Consult', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-5555' });
      patientId = pResult.lastInsertRowid;

      const vResult = createVisit({ patient_id: patientId, visit_type: 'Scheduled', triage_priority: 3, queue_position: 1, department: 'Cardiology' });
      visitId = vResult.lastInsertRowid;

      const dResult = createUser({ username: 'drheart', password_hash: 'pass', full_name: 'Dr. Heart', role: 'Doctor', department: 'Cardiology' });
      doctorId = dResult.lastInsertRowid;
    });

    it('should create consultation', () => {
      const result = createConsultation({ visit_id: visitId, patient_id: patientId, doctor_id: doctorId, chief_complaint: 'Chest pain', diagnosis: 'Angina', treatment_plan: 'Nitroglycerin, stress test', notes: 'Follow up in 1 week' });
      expect(result.lastInsertRowid).toBeDefined();

      const consultations = getConsultationsByPatient(patientId);
      expect(consultations.length).toBe(1);
    });

    it('should create prescription', () => {
      const cResult = createConsultation({ visit_id: visitId, patient_id: patientId, doctor_id: doctorId, chief_complaint: 'Chest pain', diagnosis: 'Angina', treatment_plan: 'Medication', notes: '' });
      const consultId = cResult.lastInsertRowid;

      createPrescription({ consultation_id: consultId, patient_id: patientId, medication_name: 'Nitroglycerin', dosage: '0.4mg', frequency: 'As needed', duration_days: 30, instructions: 'Place under tongue', prescribing_doctor_id: doctorId });
      const prescriptions = getPrescriptionsByPatient(patientId);
      expect(prescriptions.length).toBe(1);
      expect(prescriptions[0].medication_name).toBe('Nitroglycerin');
    });
  });

  describe('Billing', () => {
    let patientId, visitId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const pResult = createPatient({ global_id: globalId, first_name: 'Bill', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-6666' });
      patientId = pResult.lastInsertRowid;

      const vResult = createVisit({ patient_id: patientId, visit_type: 'WalkIn', triage_priority: 3, queue_position: 1, department: 'General' });
      visitId = vResult.lastInsertRowid;
    });

    it('should create invoice', () => {
      const result = createInvoice({ patient_id: patientId, visit_id: visitId, invoice_number: 'INV-TEST-001', total_amount: 150.00, insurance_applicable: 1 });
      expect(result.lastInsertRowid).toBeDefined();

      const invoice = getInvoiceById(result.lastInsertRowid);
      expect(invoice.total_amount).toBe(150.00);
      expect(invoice.balance).toBe(150.00);
      expect(invoice.status).toBe('Unpaid');
    });

    it('should update invoice status on payment', () => {
      const result = createInvoice({ patient_id: patientId, visit_id: visitId, invoice_number: 'INV-TEST-002', total_amount: 200.00, insurance_applicable: 0 });
      const invoiceId = result.lastInsertRowid;

      updateInvoiceStatus(invoiceId, 'Partial', 50.00);
      const invoice = getInvoiceById(invoiceId);
      expect(invoice.paid_amount).toBe(50.00);
      expect(invoice.balance).toBe(150.00);
      expect(invoice.status).toBe('Partial');

      updateInvoiceStatus(invoiceId, 'Paid', 200.00);
      const paidInvoice = getInvoiceById(invoiceId);
      expect(paidInvoice.status).toBe('Paid');
    });

    it('should get invoices by patient', () => {
      createInvoice({ patient_id: patientId, visit_id: visitId, invoice_number: 'INV-001', total_amount: 100, insurance_applicable: 0 });
      createInvoice({ patient_id: patientId, visit_id: visitId, invoice_number: 'INV-002', total_amount: 200, insurance_applicable: 1 });
      const invoices = getInvoicesByPatient(patientId);
      expect(invoices.length).toBe(2);
    });
  });

  describe('Laboratory', () => {
    let patientId, doctorId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const pResult = createPatient({ global_id: globalId, first_name: 'Lab', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-7777' });
      patientId = pResult.lastInsertRowid;

      const dResult = createUser({ username: 'drlab', password_hash: 'pass', full_name: 'Dr. Lab', role: 'Doctor', department: 'Internal Medicine' });
      doctorId = dResult.lastInsertRowid;
    });

    it('should create lab test', () => {
      const result = createLabTest({ patient_id: patientId, order_doctor_id: doctorId, test_name: 'CBC', test_type: 'Hematology', sample_id: 'SMP-001' });
      expect(result.lastInsertRowid).toBeDefined();

      const tests = getLabTestsByPatient(patientId);
      expect(tests.length).toBe(1);
      expect(tests[0].test_name).toBe('CBC');
      expect(tests[0].status).toBe('Ordered');
    });

    it('should update lab test status', () => {
      const result = createLabTest({ patient_id: patientId, order_doctor_id: doctorId, test_name: 'CBC', test_type: 'Hematology', sample_id: 'SMP-002' });
      updateLabTestStatus(result.lastInsertRowid, 'Completed');
      const tests = getLabTestsByPatient(patientId);
      expect(tests[0].status).toBe('Completed');
      expect(tests[0].completed_at).toBeDefined();
    });

    it('should create lab result', () => {
      const tResult = createLabTest({ patient_id: patientId, order_doctor_id: doctorId, test_name: 'Glucose', test_type: 'Chemistry', sample_id: 'SMP-003' });
      createLabResult({ lab_test_id: tResult.lastInsertRowid, result_data: '95 mg/dL', reference_range: '70-100 mg/dL', flagged: 0, lab_tech_id: doctorId });
      const results = getLabResultsByTest(tResult.lastInsertRowid);
      expect(results.length).toBe(1);
      expect(results[0].result_data).toBe('95 mg/dL');
    });
  });

  describe('Ward Management', () => {
    let patientId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const pResult = createPatient({ global_id: globalId, first_name: 'Ward', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-8888' });
      patientId = pResult.lastInsertRowid;
    });

    it('should create ward bed', () => {
      const result = createWardBed({ ward_name: 'ICU', bed_number: 'ICU-01', bed_type: 'ICU', status: 'Available' });
      expect(result.lastInsertRowid).toBeDefined();

      const beds = getAvailableBeds();
      expect(beds.length).toBeGreaterThan(0);
    });

    it('should update bed status', () => {
      const bResult = createWardBed({ ward_name: 'General', bed_number: 'G-201', bed_type: 'General', status: 'Available' });
      const bedId = bResult.lastInsertRowid;

      updateBedStatus(bedId, 'Occupied', patientId);
      const bed = getBedById(bedId);
      expect(bed.status).toBe('Occupied');
      expect(bed.patient_id).toBe(patientId);
    });

    it('should create admission', () => {
      const bResult = createWardBed({ ward_name: 'General', bed_number: 'G-202', bed_type: 'General', status: 'Available' });
      const bedId = bResult.lastInsertRowid;

      const dResult = createUser({ username: 'drward', password_hash: 'pass', full_name: 'Dr. Ward', role: 'Doctor', department: 'Ward' });
      const doctorId = dResult.lastInsertRowid;

      const result = createAdmission({ patient_id: patientId, bed_id: bedId, reason: 'Pneumonia', status: 'Admitted', admitting_doctor_id: doctorId });
      expect(result.lastInsertRowid).toBeDefined();

      const admissions = getAdmissionsByPatient(patientId);
      expect(admissions.length).toBe(1);
      expect(admissions[0].status).toBe('Admitted');
    });

    it('should discharge patient', () => {
      const bResult = createWardBed({ ward_name: 'General', bed_number: 'G-203', bed_type: 'General', status: 'Available' });
      const bedId = bResult.lastInsertRowid;

      const dResult = createUser({ username: 'drward2', password_hash: 'pass', full_name: 'Dr. Ward2', role: 'Doctor', department: 'Ward' });
      const doctorId = dResult.lastInsertRowid;

      createAdmission({ patient_id: patientId, bed_id: bedId, reason: 'Pneumonia', status: 'Admitted', admitting_doctor_id: doctorId });

      dischargePatient(patientId);
      const admissions = getAdmissionsByPatient(patientId);
      expect(admissions[0].status).toBe('Discharged');
    });
  });

  describe('Nursing Notes', () => {
    let patientId, bedId, admissionId, doctorId, nurseId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const pResult = createPatient({ global_id: globalId, first_name: 'Nurse', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-9999' });
      patientId = pResult.lastInsertRowid;

      const bResult = createWardBed({ ward_name: 'General', bed_number: 'G-301', bed_type: 'General', status: 'Available' });
      bedId = bResult.lastInsertRowid;

      const dResult = createUser({ username: 'drnurse', password_hash: 'pass', full_name: 'Dr. Nurse', role: 'Doctor', department: 'Ward' });
      doctorId = dResult.lastInsertRowid;

      const nResult = createUser({ username: 'nurse1', password_hash: 'pass', full_name: 'Nurse One', role: 'Nurse', department: 'Ward' });
      nurseId = nResult.lastInsertRowid;

      const aResult = createAdmission({ patient_id: patientId, bed_id: bedId, reason: 'Observation', status: 'Admitted', admitting_doctor_id: doctorId });
      admissionId = aResult.lastInsertRowid;
    });

    it('should create nursing note', () => {
      createNursingNote({ admission_id: admissionId, nurse_id: nurseId, note_text: 'Patient resting comfortably', vital_signs: 'BP: 120/80, HR: 72, Temp: 98.6F' });
      const notes = getNursingNotes(admissionId);
      expect(notes.length).toBe(1);
      expect(notes[0].note_text).toBe('Patient resting comfortably');
    });
  });

  describe('IoT Telemetry', () => {
    let patientId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const pResult = createPatient({ global_id: globalId, first_name: 'IoT', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Female', phone: '555-0000' });
      patientId = pResult.lastInsertRowid;
    });

    it('should create IoT telemetry', () => {
      createIoTTelemetry({ patient_id: patientId, device_type: 'HeartRateMonitor', device_id: 'HRM-001', telemetry_data: '{"heart_rate": 72, "spo2": 98}' });
      const telemetry = getLatestIoTTelemetry(patientId);
      expect(telemetry.length).toBe(1);
      expect(telemetry[0].device_type).toBe('HeartRateMonitor');
    });

    it('should limit telemetry to 50 records', () => {
      for (let i = 0; i < 60; i++) {
        createIoTTelemetry({ patient_id: patientId, device_type: 'Test', device_id: `DEV-${i}`, telemetry_data: `{"value": ${i}}` });
      }
      const telemetry = getLatestIoTTelemetry(patientId);
      expect(telemetry.length).toBe(50);
    });
  });

  describe('Operating Room', () => {
    let patientId, surgeonId;

    beforeEach(() => {
      const globalId = generateGlobalId();
      const pResult = createPatient({ global_id: globalId, first_name: 'OR', last_name: 'Patient', date_of_birth: '1990-01-01', gender: 'Male', phone: '555-1111' });
      patientId = pResult.lastInsertRowid;

      const sResult = createUser({ username: 'drsurgeon', password_hash: 'pass', full_name: 'Dr. Surgeon', role: 'Doctor', department: 'Surgery' });
      surgeonId = sResult.lastInsertRowid;
    });

    it('should create OR schedule', () => {
      const result = createORSchedule({ patient_id: patientId, procedure_name: 'Appendectomy', scheduled_date: '2025-01-15 10:00:00', surgeon_id: surgeonId, anesthesiologist_id: null, prep_complete: 0, notes: 'Standard procedure' });
      expect(result.lastInsertRowid).toBeDefined();

      const schedule = getORScheduleById(result.lastInsertRowid);
      expect(schedule.procedure_name).toBe('Appendectomy');
      expect(schedule.status).toBe('Scheduled');
    });

    it('should add OR team member', () => {
      const sResult = createORSchedule({ patient_id: patientId, procedure_name: 'Appendectomy', scheduled_date: '2025-01-15 10:00:00', surgeon_id: surgeonId, anesthesiologist_id: null, prep_complete: 0, notes: '' });
      addORTeamMember(sResult.lastInsertRowid, surgeonId, 'Surgeon');
      const team = getORTeam(sResult.lastInsertRowid);
      expect(team.length).toBe(1);
      expect(team[0].role).toBe('Surgeon');
    });

    it('should create surgical report', () => {
      const sResult = createORSchedule({ patient_id: patientId, procedure_name: 'Appendectomy', scheduled_date: '2025-01-15 10:00:00', surgeon_id: surgeonId, anesthesiologist_id: null, prep_complete: 0, notes: '' });
      createSurgicalReport({ schedule_id: sResult.lastInsertRowid, procedure_notes: 'Appendix removed', complications: 'None', outcome: 'Successful', surgeon_notes: 'Clean closure', post_op_care_instructions: 'Antibiotics x 5 days' });
      // Verify schedule status updated
      const schedule = getORScheduleById(sResult.lastInsertRowid);
      expect(schedule.status).toBe('Completed');
    });
  });

  describe('Utilities', () => {
    it('should generate unique invoice numbers', () => {
      const num1 = generateInvoiceNumber();
      const num2 = generateInvoiceNumber();
      expect(num1).not.toBe(num2);
      expect(num1).toMatch(/^INV-[A-Z0-9-]+$/);
    });
  });
});