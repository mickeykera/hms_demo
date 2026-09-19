import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

router.post('/admit', authorize(['Doctor', 'Admin']), validate('admission'), (req, res) => {
  const bed = db.getBedById(req.validated.bed_id);
  if (!bed || bed.status !== 'Available') return res.status(400).json({ error: 'Bed not available' });
  db.updateBedStatus(req.validated.bed_id, 'Occupied', req.validated.patient_id);
  const result = db.createAdmission({ ...req.validated, status: 'Admitted', admitting_doctor_id: req.user.id });
  res.status(201).json({ success: true, admission_id: result.lastInsertRowid, bed: { ward: bed.ward_name, bed_number: bed.bed_number } });
});

router.post('/discharge/:patientId', authorize(['Doctor', 'Admin', 'Nurse']), (req, res) => {
  const patientId = req.params.patientId;
  const admissions = db.getAdmissionsByPatient(patientId);
  const active = admissions.find(a => a.status === 'Admitted');
  if (!active) return res.status(400).json({ error: 'No active admission' });
  db.dischargePatient(patientId);
  const bed = db.getBedById(active.bed_id);
  if (bed) db.updateBedStatus(active.bed_id, 'Available', null);
  res.json({ success: true, discharged_at: new Date().toISOString() });
});

router.get('/beds', authorize(['Receptionist', 'Doctor', 'Nurse', 'Admin']), (req, res) => {
  const beds = db.getAvailableBeds();
  res.json({ available_beds: beds });
});

router.get('/:patientId', authorize(['Doctor', 'Nurse', 'Admin']), (req, res) => {
  const admissions = db.getAdmissionsByPatient(req.params.patientId);
  const active = admissions.find(a => a.status === 'Admitted');
  if (active) {
    const bed = db.getBedById(active.bed_id);
    const notes = db.getNursingNotes(active.id);
    res.json({ admission: active, bed, nursing_notes: notes });
  }
  res.json({ admissions, active_admission: null });
});

router.post('/:admissionId/notes', authorize(['Nurse', 'Admin']), validate('nursingNote'), (req, res) => {
  db.createNursingNote({ admission_id: req.params.admissionId, nurse_id: req.user.id, ...req.validated });
  res.status(201).json({ success: true });
});

export default router;
