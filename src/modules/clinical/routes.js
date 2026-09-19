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

router.post('/consult', authorize(['Doctor', 'Admin']), validate('consultation'), (req, res) => {
  try {
    const result = db.createConsultation(req.validated);
    res.status(201).json({ success: true, consultation_id: result.lastInsertRowid });
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
