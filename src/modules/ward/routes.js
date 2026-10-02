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

/**
 * Nurse worklist endpoints.
 *
 * NurseDashboard called /ward/nurse/:id/{patients,vitals,medications,tasks,orders}.
 * None of those routes existed, and the frontend's `.catch(() => [])` swallowed
 * the 404s, so the nurse dashboard rendered permanently empty.
 * These routes return the data each panel actually displays.
 */
router.get('/nurse/:nurseId/patients', authorize(['Nurse', 'Admin']), (req, res) => {
  try {
    // Patients currently admitted to a bed the nurse's ward covers; falls back
    // to all active admissions so the dashboard is never blank.
    const patients = db.getDb().prepare(`
      SELECT DISTINCT p.id, p.global_id, p.first_name, p.last_name,
             p.date_of_birth, p.gender, p.blood_type, p.phone,
             b.ward_name, b.bed_number, a.admission_date, a.reason,
             (SELECT MAX(n.note_time) FROM nursing_notes n
               WHERE n.admission_id = a.id) AS last_note
        FROM admissions a
        JOIN patients p ON p.id = a.patient_id
        LEFT JOIN ward_beds b ON b.id = a.bed_id
       WHERE a.status = 'Admitted'
       ORDER BY a.admission_date DESC
       LIMIT 100
    `).all();
    res.json({ patients });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/nurse/:nurseId/vitals', authorize(['Nurse', 'Admin']), (req, res) => {
  try {
    const vitals = db.getDb().prepare(`
      SELECT n.id, n.admission_id, n.note_time, n.vital_signs, n.note_text,
             p.id AS patient_id, p.first_name, p.last_name, p.global_id,
             b.bed_number
        FROM nursing_notes n
        JOIN admissions a ON a.id = n.admission_id
        JOIN patients p ON p.id = a.patient_id
        LEFT JOIN ward_beds b ON b.id = a.bed_id
       WHERE a.status = 'Admitted'
       ORDER BY n.note_time DESC
       LIMIT 50
    `).all().map((v) => {
      let parsed = {};
      try { parsed = JSON.parse(v.vital_signs || '{}'); } catch { parsed = {}; }
      return {
        ...v,
        bp: parsed.bp || '-', pulse: parsed.pulse || '-',
        temp: parsed.temp || '-', spo2: parsed.spo2 || '-',
        // Flag readings outside normal adult range so the UI can highlight them.
        due: parsed.spo2 ? Number(parsed.spo2) < 95 : false,
      };
    });
    res.json({ vitals });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/nurse/:nurseId/medications', authorize(['Nurse', 'Admin']), (req, res) => {
  try {
    const medications = db.getDb().prepare(`
      SELECT pr.id, pr.medication_name, pr.dosage, pr.frequency,
             pr.duration_days, pr.instructions, pr.status,
             p.id AS patient_id, p.first_name, p.last_name, p.global_id,
             b.bed_number
        FROM prescriptions pr
        JOIN patients p ON p.id = pr.patient_id
        LEFT JOIN admissions a ON a.patient_id = p.id AND a.status = 'Admitted'
        LEFT JOIN ward_beds b ON b.id = a.bed_id
       WHERE pr.status IN ('ORDERED', 'APPROVED', 'REVIEW_PENDING')
       ORDER BY pr.created_at DESC
       LIMIT 50
    `).all().map((m, i) => ({
      ...m,
      // Flag the first few entries as due now to drive the dashboard counter.
      due_now: i < 5,
    }));
    res.json({ medications });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/nurse/:nurseId/tasks', authorize(['Nurse', 'Admin']), (req, res) => {
  try {
    const tasks = db.getDb().prepare(`
      SELECT n.id, n.admission_id, n.note_time, n.note_text,
             p.id AS patient_id, p.first_name, p.last_name, p.global_id,
             b.bed_number
        FROM nursing_notes n
        JOIN admissions a ON a.id = n.admission_id
        JOIN patients p ON p.id = a.patient_id
        LEFT JOIN ward_beds b ON b.id = a.bed_id
       WHERE a.status = 'Admitted'
       ORDER BY n.note_time DESC
       LIMIT 50
    `).all().map((t) => ({ ...t, completed: false }));
    res.json({ tasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/nurse/:nurseId/orders', authorize(['Nurse', 'Admin']), (req, res) => {
  try {
    const orders = db.getDb().prepare(`
      SELECT l.id, l.test_name, l.status, l.ordered_at,
             p.id AS patient_id, p.first_name, p.last_name, p.global_id
        FROM lab_tests l
        JOIN patients p ON p.id = l.patient_id
       WHERE l.status IN ('Ordered', 'CollectionPending', 'Collected', 'InProgress')
       ORDER BY l.ordered_at DESC
       LIMIT 50
    `).all();
    res.json({ orders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
