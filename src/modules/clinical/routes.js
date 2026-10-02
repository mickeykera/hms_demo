import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

router.get('/doctors', authorize(['Receptionist', 'Admin', 'Doctor', 'Nurse']), (req, res) => {
  const doctors = db.getDb().prepare(
    `SELECT id, username, full_name, role, department FROM users
     WHERE role = 'Doctor' ORDER BY full_name`
  ).all();
  res.json({ doctors });
});

/**
 * Doctor-scoped worklist.
 *
 * The doctor dashboard used to call /clinical/doctors/:id/patients and
 * /clinical/consultations, neither of which existed, so every panel rendered
 * empty. These endpoints return the data the dashboard actually renders.
 */
router.get(
  '/doctors/:doctorId/patients',
  authorize(['Doctor', 'Admin', 'Nurse']),
  (req, res) => {
    try {
      const patients = db.getDb().prepare(`
        SELECT DISTINCT p.id, p.global_id, p.first_name, p.last_name,
               p.date_of_birth, p.gender, p.blood_type, p.phone,
               (SELECT MAX(a.scheduled_date) FROM appointments a
                 WHERE a.patient_id = p.id AND a.doctor_id = ?) AS last_visit
          FROM patients p
          JOIN appointments a ON a.patient_id = p.id
         WHERE a.doctor_id = ?
         ORDER BY last_visit DESC
      `).all(req.params.doctorId, req.params.doctorId);
      res.json({ patients });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

router.get(
  '/consultations',
  authorize(['Doctor', 'Admin', 'Nurse']),
  (req, res) => {
    try {
      const { doctor_id: doctorId, status } = req.query;
      let sql = `
        SELECT c.*, p.first_name AS patient_first, p.last_name AS patient_last,
               p.global_id AS patient_global_id
          FROM consultations c
          JOIN patients p ON p.id = c.patient_id
         WHERE 1=1`;
      const params = [];
      if (doctorId) { sql += ' AND c.doctor_id = ?'; params.push(doctorId); }
      if (status) { sql += ' AND c.status = ?'; params.push(status); }
      sql += ' ORDER BY c.consultation_date DESC LIMIT 50';
      res.json({ consultations: db.getDb().prepare(sql).all(...params) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Get-or-create the patient's open visit for a new encounter.
 *
 * The consultations table requires a visit_id, so a SOAP note cannot be
 * started without one. Rather than make the clinician pick a visit from a
 * dropdown, this reuses the most recent unfinished visit or opens a new one.
 */
router.post(
  '/:patientId/visit',
  authorize(['Doctor', 'Admin']),
  (req, res) => {
    try {
      const patientId = Number(req.params.patientId);
      const patient = db.getPatientById(patientId);
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      const open = db.getDb().prepare(`
        SELECT * FROM visits
         WHERE patient_id = ?
           AND status IN ('Waiting','InConsultation')
         ORDER BY check_in_time DESC
         LIMIT 1
      `).get(patientId);

      if (open) {
        // Mark it as actively being seen so it shows up in the ward queue.
        db.updateVisitStatus(open.id, 'InConsultation');
        return res.json({ success: true, visit: db.getVisitById(open.id), created: false });
      }

      const result = db.createVisit({
        patient_id: patientId,
        visit_type: 'Scheduled',
        triage_priority: 3,
        queue_position: 0,
        department: 'Outpatient',
      });
      db.updateVisitStatus(result.lastInsertRowid, 'InConsultation');

      res.status(201).json({
        success: true,
        visit: db.getVisitById(result.lastInsertRowid),
        created: true,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Save a draft SOAP note. Drafts are never clinically final, so this
 * deliberately does not touch status or signed_at.
 */
router.put(
  '/consultations/:id/soap',
  authorize(['Doctor', 'Admin']),
  validate('soapNote'),
  (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = db.getConsultationById(id);
      if (!existing) return res.status(404).json({ error: 'Consultation not found' });
      if (existing.status === 'Signed') {
        return res.status(409).json({ error: 'This note is signed and can no longer be edited' });
      }
      // Doctors may only edit their own notes; Admin may edit any.
      if (existing.doctor_id !== req.user.id && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'You can only edit your own notes' });
      }
      db.updateConsultationSoap(id, req.validated);
      res.json({ success: true, consultation: db.getConsultationById(id) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Sign and finalize a SOAP note.
 *
 * Requires Subjective, Assessment and Plan. Objective findings can legitimately
 * be empty ("nothing abnormal on exam"), so it is not required.
 *
 * Also closes out the associated visit: a finalized encounter should not stay
 * in the queue as InConsultation.
 */
router.post('/consultations/:id/sign', authorize(['Doctor', 'Admin']), (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.getConsultationById(id);
    if (!existing) return res.status(404).json({ error: 'Consultation not found' });

    if (existing.status === 'Signed') {
      return res.status(409).json({ error: 'This note is already signed' });
    }
    if (existing.doctor_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only sign your own notes' });
    }

    const missing = ['subjective', 'assessment', 'plan'].filter(
      f => !existing[f] || !String(existing[f]).trim()
    );
    if (missing.length) {
      return res.status(400).json({
        error: `Cannot sign: complete the ${missing.join(', ')} section${missing.length > 1 ? 's' : ''} first`,
        missing_sections: missing,
      });
    }

    db.signConsultation(id);
    db.updateVisitStatus(existing.visit_id, 'Completed');

    db.createAuditLog({
      actor_id: req.user.id,
      action: 'SIGN',
      resource_type: 'consultation',
      resource_id: id,
      details: `Signed SOAP note for patient ${existing.patient_id}`,
      ip_address: req.ip,
    });

    res.json({ success: true, consultation: db.getConsultationById(id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/consult', authorize(['Doctor', 'Admin']), validate('consultation'), (req, res) => {
  try {
    const result = db.createConsultation(req.validated);
    const id = result.lastInsertRowid;
    const consultation = db.getConsultationById(id);

    db.createAuditLog({
      actor_id: req.user.id,
      action: 'CREATE',
      resource_type: 'consultation',
      resource_id: id,
      details: `Started SOAP note for patient ${req.validated.patient_id}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, consultation_id: id, consultation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:patientId', authorize(['Doctor', 'Nurse', 'Admin', 'LabTech']), (req, res) => {
  const patient = db.getPatientById(req.params.patientId);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const history = db.getMedicalHistory(req.params.patientId);
  const consultations = db.getConsultationsByPatient(req.params.patientId);
  res.json({ patient, medical_history: history, consultations });
});

router.post('/:patientId/history', authorize(['Doctor', 'Admin']), validate('medicalHistory'), (req, res) => {
  db.createMedicalHistory({ patient_id: req.params.patientId, ...req.validated });
  res.status(201).json({ success: true });
});

router.post('/:patientId/prescription', authorize(['Doctor', 'Admin']), validate('prescription'), (req, res) => {
  try {
    const result = db.createPrescription({ ...req.validated, patient_id: req.params.patientId, prescribing_doctor_id: req.user.id });
    const prescriptionId = result.lastInsertRowid;
    const pharmacists = db.getDb().prepare("SELECT id FROM users WHERE role = 'Pharmacy' AND active = 1").all();
    for (const pharmacist of pharmacists) {
      db.createNotification({
        recipient_id: pharmacist.id,
        type: 'PRESCRIPTION_ORDERED',
        title: 'New Prescription Requires Review',
        message: `${req.validated.medication_name} ordered for patient ${req.params.patientId}`,
        related_entity: 'prescription',
        related_entity_id: prescriptionId,
      });
    }
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'CREATE',
      resource_type: 'prescription',
      resource_id: prescriptionId,
      details: `Ordered ${req.validated.medication_name} for patient ${req.params.patientId}`,
      ip_address: req.ip,
    });
    res.status(201).json({ success: true, prescription_id: prescriptionId, status: 'ORDERED' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:patientId/prescriptions', authorize(['Doctor', 'Nurse', 'Admin', 'Pharmacy', 'Billing']), (req, res) => {
  const prescriptions = db.getPrescriptionsByPatient(req.params.patientId);
  res.json({ prescriptions });
});

router.get('/:patientId/emr', authorize(['Doctor', 'Admin']), (req, res) => {
  const patient = db.getPatientById(req.params.patientId);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const history = db.getMedicalHistory(req.params.patientId);
  const consultations = db.getConsultationsByPatient(req.params.patientId);
  const prescriptions = db.getPrescriptionsByPatient(req.params.patientId);
  res.json({ patient, medical_history: history, consultations, prescriptions });
});

export default router;
