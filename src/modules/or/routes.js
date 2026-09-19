import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

router.post('/schedule', authorize(['Doctor', 'Admin']), validate('orSchedule'), (req, res) => {
  try {
    const patient = db.getPatientById(req.validated.patient_id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const result = db.createORSchedule({ ...req.validated, prep_complete: 0 });
    res.status(201).json({ success: true, schedule_id: result.lastInsertRowid });
  } catch (e) {
    console.error('OR Schedule error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:scheduleId/team', authorize(['Doctor', 'Admin']), validate('orTeam'), (req, res) => {
  db.addORTeamMember(req.params.scheduleId, req.validated.member_id, req.validated.role);
  res.status(201).json({ success: true });
});

router.get('/:scheduleId', authorize(['Doctor', 'Admin', 'Nurse']), (req, res) => {
  const schedule = db.getORScheduleById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  const team = db.getORTeam(req.params.scheduleId);
  res.json({ schedule, team });
});

router.post('/:scheduleId/report', authorize(['Doctor', 'Admin']), validate('surgicalReport'), (req, res) => {
  db.createSurgicalReport({ schedule_id: req.params.scheduleId, ...req.validated });
  db.updateORScheduleStatus(req.params.scheduleId, 'Completed');
  res.json({ success: true });
});

export default router;
