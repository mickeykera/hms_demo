import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

const ED = ['Admin', 'SuperAdmin', 'Receptionist', 'Nurse', 'Doctor'];

// ---------- Ambulances ----------
router.get('/ambulances', authorize(ED), (req, res, next) => {
  try {
    const fleet = db.getDb().prepare(`
      SELECT a.*,
             (SELECT COUNT(*) FROM dispatches d
               WHERE d.ambulance_id = a.id AND d.status NOT IN ('Completed','Cancelled')) AS active_dispatch
        FROM ambulances a
       ORDER BY a.unit_number
    `).all();
    res.json({ ambulances: fleet });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

router.post('/ambulances', authorize(['Admin', 'SuperAdmin']), validate('ambulance'), (req, res, next) => {
  try {
    const v = req.validated;
    const r = db.getDb().prepare(`
      INSERT INTO ambulances (unit_number, vehicle_type, crew_size, status, current_location)
      VALUES (?, ?, ?, ?, ?)
    `).run(v.unit_number, v.vehicle_type || 'Basic Life Support', v.crew_size ?? 2, v.status, v.current_location || null);
    res.status(201).json({
      success: true,
      ambulance: db.getDb().prepare('SELECT * FROM ambulances WHERE id = ?').get(r.lastInsertRowid),
    });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// ---------- Dispatches ----------
router.get('/dispatches', authorize(ED), (req, res, next) => {
  try {
    const { status } = req.query;
    const dispatches = db.getDb().prepare(`
      SELECT d.*, a.unit_number, a.vehicle_type
        FROM dispatches d
        LEFT JOIN ambulances a ON a.id = d.ambulance_id
       WHERE (? IS NULL OR d.status = ?)
       ORDER BY d.dispatched_at DESC
       LIMIT 100
    `).all(status || null, status || null);
    res.json({ dispatches });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

router.post('/dispatches', authorize(ED), validate('dispatch'), (req, res, next) => {
  try {
    const v = req.validated;

    // An available unit is required: dispatching an already-committed
    // ambulance would silently double-book it.
    if (v.ambulance_id) {
      const unit = db.getDb().prepare('SELECT * FROM ambulances WHERE id = ?').get(v.ambulance_id);
      if (!unit) return res.status(400).json({ error: 'Unknown ambulance unit' });
      if (unit.status !== 'Available') {
        return res.status(409).json({ error: `Unit ${unit.unit_number} is ${unit.status}` });
      }
    }

    const r = db.getDb().prepare(`
      INSERT INTO dispatches
        (ambulance_id, incident_location, incident_type, priority, patient_name, destination, dispatched_by, eta_minutes, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      v.ambulance_id ?? null, v.incident_location, v.incident_type || null, v.priority,
      v.patient_name || null, v.destination || null, req.user.id, v.eta_minutes ?? null, v.notes || null
    );

    if (v.ambulance_id) {
      db.getDb().prepare("UPDATE ambulances SET status = 'Dispatched' WHERE id = ?").run(v.ambulance_id);
    }

    db.createAuditLog({
      actor_id: req.user.id, action: 'CREATE', resource_type: 'dispatch',
      resource_id: r.lastInsertRowid,
      details: `${v.priority} dispatch to ${v.incident_location}`, ip_address: req.ip,
    });

    res.status(201).json({
      success: true,
      dispatch: db.getDb().prepare('SELECT * FROM dispatches WHERE id = ?').get(r.lastInsertRowid),
    });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

/**
 * Advance a dispatch. Completing or cancelling releases the unit so it
 * becomes dispatchable again.
 */
router.put('/dispatches/:id/status', authorize(ED), validate('dispatchStatus'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const d = db.getDb().prepare('SELECT * FROM dispatches WHERE id = ?').get(id);
    if (!d) return res.status(404).json({ error: 'Dispatch not found' });
    if (['Completed', 'Cancelled'].includes(d.status)) {
      return res.status(409).json({ error: `Dispatch is already ${d.status}` });
    }

    const status = req.validated.status;
    db.getDb().prepare(`
      UPDATE dispatches SET status = ?, completed_at = CASE WHEN ? IN ('Completed','Cancelled')
        THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = ?
    `).run(status, status, id);

    if (d.ambulance_id) {
      const unitStatus = ['Completed', 'Cancelled'].includes(status) ? 'Available' : 'EnRoute';
      db.getDb().prepare('UPDATE ambulances SET status = ? WHERE id = ?').run(unitStatus, d.ambulance_id);
    }

    res.json({ success: true, dispatch: db.getDb().prepare('SELECT * FROM dispatches WHERE id = ?').get(id) });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

/**
 * ED statistics. Derived from the visits table rather than stored, so the
 * numbers can never drift from the actual queue.
 */
router.get('/statistics', authorize(ED), (req, res, next) => {
  try {
    const totals = db.getDb().prepare(`
      SELECT
        (SELECT COUNT(*) FROM visits WHERE date(check_in_time) = date('now')) AS visits_today,
        (SELECT COUNT(*) FROM visits WHERE status = 'Waiting') AS waiting_now,
        (SELECT COUNT(*) FROM visits WHERE status = 'InConsultation') AS in_consultation,
        (SELECT COUNT(*) FROM visits WHERE status = 'Completed') AS completed_total,
        (SELECT COUNT(*) FROM visits WHERE visit_type = 'Emergency') AS emergency_visits,
        (SELECT COALESCE(AVG(julianday(check_out_time) - julianday(check_in_time)), 0)
           FROM visits WHERE check_out_time IS NOT NULL) AS avg_length_of_stay_days
    `).get();

    const byPriority = db.getDb().prepare(`
      SELECT triage_priority AS priority, COUNT(*) AS count
        FROM visits
       WHERE status IN ('Waiting','InConsultation')
       GROUP BY triage_priority
       ORDER BY triage_priority
    `).all();

    const byType = db.getDb().prepare(`
      SELECT visit_type AS type, COUNT(*) AS count
        FROM visits
       WHERE date(check_in_time) >= date('now','-7 days')
       GROUP BY visit_type
       ORDER BY count DESC
    `).all();

    const beds = db.getDb().prepare(
      'SELECT status, COUNT(*) AS count FROM ward_beds GROUP BY status'
    ).all();

    const fleet = db.getDb().prepare(
      'SELECT status, COUNT(*) AS count FROM ambulances GROUP BY status'
    ).all();

    res.json({ totals, byPriority, byType, beds, fleet });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

/** Bed resources for the ED "Resource management" tab. */
router.get('/resources', authorize(ED), (req, res, next) => {
  try {
    const beds = db.getDb().prepare('SELECT * FROM ward_beds ORDER BY ward_name, bed_number').all();
    const ambulances = db.getDb().prepare('SELECT * FROM ambulances ORDER BY unit_number').all();
    res.json({ beds, ambulances });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

export default router;