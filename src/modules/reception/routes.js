import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { getPatientDashboard } from '../../models/patient-engine.js';

const router = Router();

router.post('/register', authorize(['Receptionist', 'Admin']), validate('patientRegister'), (req, res) => {
  try {
    const globalId = db.generateGlobalId();
    const result = db.createPatient({ global_id: globalId, ...req.validated });
    const patient = db.getPatientById(result.lastInsertRowid);
    res.status(201).json({ success: true, global_id: patient.global_id, patient });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:globalId/checkin', authorize(['Receptionist', 'Admin']), validate('patientCheckin'), (req, res) => {
  try {
    const patient = db.getPatientByGlobalId(req.params.globalId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const queuePos = db.getNextQueuePosition('General');
    const result = db.createVisit({ patient_id: patient.id, visit_type: 'WalkIn', triage_priority: req.validated.triage_priority || 3, queue_position: queuePos, department: 'General' });
    const visit = db.getVisitById(result.lastInsertRowid);
    res.status(201).json({ success: true, visit_id: visit.id, queue_position: visit.queue_position, global_id: patient.global_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/queue/:department', authorize(['Receptionist', 'Admin', 'Doctor']), (req, res) => {
  const patients = db.getWaitingPatients(req.params.department);
  res.json({ department: req.params.department, waiting_patients: patients });
});

router.get('/search', authorize(['Receptionist', 'Admin', 'Doctor', 'Nurse', 'Billing', 'LabTech']), (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.json({ patients: [] });
  const like = `%${query}%`;
  const patients = db.getDb().prepare(
    `SELECT * FROM patients
     WHERE global_id LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?
     ORDER BY last_name, first_name LIMIT 50`
  ).all(like, like, like, like, like);
  res.json({ patients });
});

router.get('/:globalId', authorize(['Receptionist', 'Admin', 'Doctor', 'Nurse', 'Billing', 'LabTech']), (req, res) => {
  const patient = db.getPatientByGlobalId(req.params.globalId);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json({ patient });
});

router.put('/:globalId', authorize(['Receptionist', 'Admin', 'Doctor']), (req, res) => {
  const patient = db.getPatientByGlobalId(req.params.globalId);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  db.updatePatient(patient.id, req.body);
  res.json({ success: true, patient: db.getPatientByGlobalId(req.params.globalId) });
});

router.get('/:globalId/dashboard', authorize(['Receptionist', 'Admin', 'Doctor', 'Nurse', 'Billing', 'LabTech']), (req, res) => {
  const dashboard = getPatientDashboard(req.params.globalId);
  if (!dashboard) return res.status(404).json({ error: 'Patient not found' });
  res.json(dashboard);
});

export default router;
