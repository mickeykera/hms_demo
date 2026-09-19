import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

router.get('/', authorize(['Receptionist', 'Admin', 'Doctor', 'Nurse']), (req, res) => {
  const { doctor_id, patient_id, date, status } = req.query;
  let query = 'SELECT a.*, p.first_name as patient_first, p.last_name as patient_last, d.first_name as doctor_first, d.last_name as doctor_last FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users d ON a.doctor_id = d.id WHERE 1=1';
  const params = [];

  if (doctor_id) {
    query += ' AND a.doctor_id = ?';
    params.push(doctor_id);
  }
  if (patient_id) {
    query += ' AND a.patient_id = ?';
    params.push(patient_id);
  }
  if (date) {
    query += ' AND DATE(a.scheduled_date) = DATE(?)';
    params.push(date);
  }
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }

  query += ' ORDER BY a.scheduled_date ASC';
  const appointments = db.getDb().prepare(query).all(...params);
  res.json({ appointments });
});

router.post('/', authorize(['Receptionist', 'Admin', 'Doctor']), validate('appointment'), (req, res) => {
  try {
    const conflict = db.getDb().prepare(
      `SELECT id FROM appointments
       WHERE doctor_id = ? AND status NOT IN ('Cancelled', 'NoShow', 'Completed')
       AND datetime(scheduled_date) < datetime(?, '+' || duration_minutes || ' minutes')
       AND datetime(scheduled_date, '+' || duration_minutes || ' minutes') > datetime(?)`
    ).get(req.validated.doctor_id, req.validated.scheduled_date, req.validated.scheduled_date);
    if (conflict) return res.status(409).json({ error: 'Doctor already has an appointment in this time window' });
    const result = db.getDb().prepare(
      'INSERT INTO appointments (patient_id, doctor_id, scheduled_date, duration_minutes, appointment_type, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.validated.patient_id, req.validated.doctor_id, req.validated.scheduled_date, req.validated.duration_minutes, req.validated.appointment_type, req.validated.notes || null);
    const appointment = db.getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, appointment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authorize(['Receptionist', 'Admin', 'Doctor', 'Nurse']), (req, res) => {
  const appointment = db.getDb().prepare(
    'SELECT a.*, p.first_name as patient_first, p.last_name as patient_last, p.global_id as patient_global_id, d.first_name as doctor_first, d.last_name as doctor_last FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users d ON a.doctor_id = d.id WHERE a.id = ?'
  ).get(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ appointment });
});

router.put('/:id', authorize(['Receptionist', 'Admin', 'Doctor']), validate('appointmentUpdate'), (req, res) => {
  try {
    const current = db.getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'Doctor' && current.doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'Doctors can only update their own appointments' });
    }
    const fields = Object.keys(req.validated).map(k => `${k} = ?`).join(', ');
    if (!fields) return res.status(400).json({ error: 'No appointment fields provided' });
    const values = [...Object.values(req.validated), req.params.id];
    db.getDb().prepare(`UPDATE appointments SET ${fields} WHERE id = ?`).run(...values);
    const appointment = db.getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json({ success: true, appointment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/status', authorize(['Receptionist', 'Admin', 'Doctor']), (req, res) => {
  const { status } = req.body;
  const transitions = {
    Scheduled: ['Confirmed', 'Cancelled', 'NoShow'],
    Confirmed: ['InProgress', 'Cancelled', 'NoShow'],
    InProgress: ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: [],
    NoShow: [],
  };
  if (!Object.keys(transitions).includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const appointment = db.getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (req.user.role === 'Doctor' && appointment.doctor_id !== req.user.id) {
    return res.status(403).json({ error: 'Doctors can only manage their own appointments' });
  }
  if (!transitions[appointment.status].includes(status)) {
    return res.status(400).json({ error: `Cannot change status from ${appointment.status} to ${status}` });
  }
  db.getDb().prepare('UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  db.createNotification({
    recipient_id: appointment.doctor_id,
    type: 'APPOINTMENT_STATUS_UPDATE',
    title: 'Appointment Status Update',
    message: `Appointment ${appointment.id} is now ${status}`,
    related_entity: 'appointment',
    related_entity_id: appointment.id,
  });
  db.createAuditLog({ actor_id: req.user.id, action: 'UPDATE_STATUS', resource_type: 'appointment', resource_id: appointment.id, details: `Status changed from ${appointment.status} to ${status}`, ip_address: req.ip });
  res.json({ success: true, appointment: db.getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id) });
});

router.get('/doctor/:doctorId/schedule', authorize(['Doctor', 'Admin']), (req, res) => {
  const { date } = req.query;
  let query = 'SELECT a.*, p.first_name as patient_first, p.last_name as patient_last FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.doctor_id = ?';
  const params = [req.params.doctorId];
  if (date) {
    query += ' AND DATE(a.scheduled_date) = DATE(?)';
    params.push(date);
  }
  query += ' ORDER BY a.scheduled_date ASC';
  const appointments = db.getDb().prepare(query).all(...params);
  res.json({ appointments });
});

export default router;