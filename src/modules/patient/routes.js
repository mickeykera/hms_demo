import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();

function getCurrentPatientId(req) {
  const user = db.getDb().prepare('SELECT patient_id FROM users WHERE id = ?').get(req.user.id);
  return user?.patient_id || null;
}

// Get current patient's profile (only for patient users)
router.get('/me', authorize(['Patient']), (req, res, next) => {
  try {
    if (req.user.role !== 'Patient') {
      return res.status(403).json({ error: 'Only patients can access this endpoint' });
    }
    
    const patientId = getCurrentPatientId(req);
    const patient = patientId ? db.getPatientById(patientId) : null;
    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }
    res.json({ patient });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Get patient's appointments
router.get('/appointments', authorize(['Patient']), (req, res, next) => {
  try {
    const patientId = getCurrentPatientId(req);
    if (!patientId) return res.status(404).json({ error: 'Patient record not linked' });
    const appointments = db.getDb().prepare(
      'SELECT a.*, u.full_name as doctor_name FROM appointments a JOIN users u ON a.doctor_id = u.id WHERE a.patient_id = ? ORDER BY a.scheduled_date DESC'
    ).all(patientId);
    
    res.json({ appointments });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Get patient's prescriptions
router.get('/prescriptions', authorize(['Patient']), (req, res, next) => {
  try {
    const prescriptions = db.getDb().prepare(
      'SELECT p.*, u.full_name as doctor_name FROM prescriptions p LEFT JOIN users u ON p.prescribing_doctor_id = u.id WHERE p.patient_id = ? ORDER BY p.created_at DESC'
    ).all(getCurrentPatientId(req));
    
    res.json({ prescriptions });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Get patient's lab results
router.get('/lab-results', authorize(['Patient']), (req, res, next) => {
  try {
    const results = db.getDb().prepare(
      'SELECT lr.*, lt.test_name, lt.status, u.full_name as doctor_name FROM lab_results lr JOIN lab_tests lt ON lr.lab_test_id = lt.id LEFT JOIN users u ON lt.order_doctor_id = u.id WHERE lt.patient_id = ? ORDER BY lr.entered_at DESC'
    ).all(getCurrentPatientId(req));
    
    res.json({ lab_results: results });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Get patient's medical history
router.get('/medical-history', authorize(['Patient']), (req, res, next) => {
  try {
    const history = db.getDb().prepare('SELECT * FROM medical_history WHERE patient_id = ? ORDER BY created_at DESC').all(getCurrentPatientId(req));
    
    res.json({ medical_history: history });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Get patient's invoices
router.get('/invoices', authorize(['Patient']), (req, res, next) => {
  try {
    const invoices = db.getDb().prepare('SELECT * FROM invoices WHERE patient_id = ? ORDER BY created_at DESC').all(getCurrentPatientId(req));
    
    res.json({ invoices });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Book appointment
router.post('/appointments', authorize(['Patient']), (req, res, next) => {
  try {
    const { doctor_id, scheduled_date, duration_minutes, appointment_type, notes } = req.body;
    
    if (!doctor_id || !scheduled_date) {
      return res.status(400).json({ error: 'doctor_id and scheduled_date are required' });
    }
    
    // Check for conflicts
    const conflict = db.getDb().prepare(
      `SELECT id FROM appointments
       WHERE doctor_id = ? AND status NOT IN ('Cancelled', 'NoShow', 'Completed')
       AND datetime(scheduled_date) < datetime(?, '+' || COALESCE(?, 30) || ' minutes')
       AND datetime(scheduled_date, '+' || COALESCE(?, 30) || ' minutes') > datetime(?)`
    ).get(doctor_id, scheduled_date, duration_minutes, duration_minutes, scheduled_date);
    
    if (conflict) {
      return res.status(409).json({ error: 'Doctor already has an appointment in this time window' });
    }
    
    const patientId = getCurrentPatientId(req);
    if (!patientId) return res.status(404).json({ error: 'Patient record not linked' });
    const result = db.getDb().prepare(
      'INSERT INTO appointments (patient_id, doctor_id, scheduled_date, duration_minutes, appointment_type, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(patientId, doctor_id, scheduled_date, duration_minutes || 30, appointment_type || 'Consultation', notes || null, 'Scheduled');
    
    const appointment = db.getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, appointment });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

export default router;
