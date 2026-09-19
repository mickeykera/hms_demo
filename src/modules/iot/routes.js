import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

router.post('/webhook', authorize(['Admin', 'Doctor', 'Nurse']), validate('iotTelemetry'), (req, res) => {
  try {
    const patient = db.getPatientById(req.validated.patient_id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const result = db.createIoTTelemetry(req.validated);
    res.status(201).json({ success: true, telemetry_id: result.lastInsertRowid, patient_global_id: patient.global_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:patientId', authorize(['Admin', 'Doctor', 'Nurse']), (req, res) => {
  const telemetry = db.getLatestIoTTelemetry(req.params.patientId);
  res.json({ patient_id: req.params.patientId, device_readings: telemetry });
});

router.get('/:patientId/latest', authorize(['Admin', 'Doctor', 'Nurse']), (req, res) => {
  const telemetry = db.getLatestIoTTelemetry(req.params.patientId);
  res.json({ patient_id: req.params.patientId, latest_reading: telemetry[0] || null });
});

export default router;
