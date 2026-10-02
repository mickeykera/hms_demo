import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

const HR = ['Admin', 'SuperAdmin'];

// Every HR read joins personnel for a display name, so the UI never has to
// resolve ids itself. personnel stores first/last separately and points at
// departments by id, so the display name is composed here.
const NAME_COLS = `p.id AS personnel_id,
  TRIM(p.first_name || ' ' || p.last_name) AS full_name,
  p.professional_title,
  d.name AS department`;

// ---------- Attendance ----------
router.get('/attendance', authorize(HR), (req, res) => {
  try {
    const { date, personnel_id } = req.query;
    const records = db.getDb().prepare(`
      SELECT a.*, ${NAME_COLS}
        FROM employee_attendance a
        JOIN personnel p ON p.id = a.personnel_id
        LEFT JOIN departments d ON d.id = p.department_id
       WHERE (? IS NULL OR a.work_date = ?)
         AND (? IS NULL OR a.personnel_id = ?)
       ORDER BY a.work_date DESC, full_name
       LIMIT 200
    `).all(date || null, date || null, personnel_id || null, personnel_id || null);
    res.json({ attendance: records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/attendance', authorize(HR), validate('attendance'), (req, res) => {
  try {
    const v = req.validated;
    const person = db.getDb().prepare('SELECT id FROM personnel WHERE id = ?').get(v.personnel_id);
    if (!person) return res.status(400).json({ error: 'Unknown personnel' });

    // Re-marking the same day overwrites rather than duplicating: the table
    // has a UNIQUE(personnel_id, work_date) constraint and users expect a
    // correction, not a second shift.
    db.getDb().prepare(`
      INSERT INTO employee_attendance (personnel_id, work_date, clock_in, clock_out, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(personnel_id, work_date) DO UPDATE SET
        clock_in = excluded.clock_in,
        clock_out = excluded.clock_out,
        status = excluded.status,
        notes = excluded.notes
    `).run(v.personnel_id, v.work_date, v.clock_in || null, v.clock_out || null, v.status, v.notes || null);

    const record = db.getDb().prepare(`
      SELECT a.*, ${NAME_COLS}
        FROM employee_attendance a JOIN personnel p ON p.id = a.personnel_id LEFT JOIN departments d ON d.id = p.department_id
       WHERE a.personnel_id = ? AND a.work_date = ?
    `).get(v.personnel_id, v.work_date);

    res.status(201).json({ success: true, record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Leave ----------
router.get('/leave', authorize(HR), (req, res) => {
  try {
    const { status } = req.query;
    const requests = db.getDb().prepare(`
      SELECT lr.*, ${NAME_COLS}
        FROM leave_requests lr
        JOIN personnel p ON p.id = lr.personnel_id
        LEFT JOIN departments d ON d.id = p.department_id
       WHERE (? IS NULL OR lr.status = ?)
       ORDER BY lr.created_at DESC
    `).all(status || null, status || null);
    res.json({ leave: requests });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/leave', authorize(HR), validate('leaveRequest'), (req, res) => {
  try {
    const v = req.validated;
    const r = db.getDb().prepare(`
      INSERT INTO leave_requests (personnel_id, leave_type, start_date, end_date, days, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(v.personnel_id, v.leave_type, v.start_date, v.end_date, v.days, v.reason || null);

    const request = db.getDb().prepare(`
      SELECT lr.*, ${NAME_COLS}
        FROM leave_requests lr JOIN personnel p ON p.id = lr.personnel_id LEFT JOIN departments d ON d.id = p.department_id
       WHERE lr.id = ?
    `).get(r.lastInsertRowid);

    res.status(201).json({ success: true, request });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/leave/:id/decision', authorize(HR), validate('leaveDecision'), (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.getDb().prepare('SELECT * FROM leave_requests WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Leave request not found' });
    if (existing.status !== 'Pending') {
      return res.status(409).json({ error: `Request is already ${existing.status}` });
    }

    db.getDb().prepare(`
      UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.validated.status, req.user.id, id);

    res.json({ success: true, request: db.getDb().prepare('SELECT * FROM leave_requests WHERE id = ?').get(id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Payroll ----------
// net_pay is always derived here: basic + allowances - deductions. The client
// never supplies it, so a tampered payload cannot inflate a payslip.
router.get('/payroll', authorize(HR), (req, res) => {
  try {
    const { pay_period } = req.query;
    const records = db.getDb().prepare(`
      SELECT pr.*, ${NAME_COLS}
        FROM payroll_records pr
        JOIN personnel p ON p.id = pr.personnel_id
        LEFT JOIN departments d ON d.id = p.department_id
       WHERE (? IS NULL OR pr.pay_period = ?)
       ORDER BY pr.pay_period DESC, full_name
    `).all(pay_period || null, pay_period || null);
    res.json({ payroll: records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/payroll', authorize(HR), validate('payroll'), (req, res) => {
  try {
    const v = req.validated;
    const person = db.getDb().prepare('SELECT id FROM personnel WHERE id = ?').get(v.personnel_id);
    if (!person) return res.status(400).json({ error: 'Unknown personnel' });

    const net = v.basic_salary + v.allowances - v.deductions;
    db.getDb().prepare(`
      INSERT INTO payroll_records (personnel_id, pay_period, basic_salary, allowances, deductions, net_pay, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(personnel_id, pay_period) DO UPDATE SET
        basic_salary = excluded.basic_salary,
        allowances = excluded.allowances,
        deductions = excluded.deductions,
        net_pay = excluded.net_pay,
        status = excluded.status
    `).run(v.personnel_id, v.pay_period, v.basic_salary, v.allowances, v.deductions, net, v.status);

    const record = db.getDb().prepare(`
      SELECT pr.*, ${NAME_COLS}
        FROM payroll_records pr JOIN personnel p ON p.id = pr.personnel_id LEFT JOIN departments d ON d.id = p.department_id
       WHERE pr.personnel_id = ? AND pr.pay_period = ?
    `).get(v.personnel_id, v.pay_period);

    res.status(201).json({ success: true, record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// ---------- Performance ----------
router.get('/reviews', authorize(HR), (req, res) => {
  try {
    const reviews = db.getDb().prepare(`
      SELECT pr.*, ${NAME_COLS}
        FROM performance_reviews pr
        JOIN personnel p ON p.id = pr.personnel_id
        LEFT JOIN departments d ON d.id = p.department_id
       ORDER BY pr.created_at DESC
    `).all();
    res.json({ reviews });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/reviews', authorize(HR), validate('performanceReview'), (req, res) => {
  try {
    const v = req.validated;
    const person = db.getDb().prepare('SELECT id FROM personnel WHERE id = ?').get(v.personnel_id);
    if (!person) return res.status(400).json({ error: 'Unknown personnel' });

    db.getDb().prepare(`
      INSERT INTO performance_reviews (personnel_id, review_period, rating, strengths, improvements, goals, reviewer_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(personnel_id, review_period) DO UPDATE SET
        rating = excluded.rating,
        strengths = excluded.strengths,
        improvements = excluded.improvements,
        goals = excluded.goals,
        reviewer_id = excluded.reviewer_id,
        status = excluded.status
    `).run(
      v.personnel_id, v.review_period, v.rating ?? null,
      v.strengths || null, v.improvements || null, v.goals || null, req.user.id, v.status
    );

    const review = db.getDb().prepare(`
      SELECT pr.*, ${NAME_COLS}
        FROM performance_reviews pr JOIN personnel p ON p.id = pr.personnel_id LEFT JOIN departments d ON d.id = p.department_id
       WHERE pr.personnel_id = ? AND pr.review_period = ?
    `).get(v.personnel_id, v.review_period);

    res.status(201).json({ success: true, review });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- HR summary (drives the dashboard stat tiles) ----------
router.get('/summary', authorize(HR), (req, res) => {
  try {
    const totals = db.getDb().prepare(`
      SELECT
        (SELECT COUNT(*) FROM personnel) AS headcount,
        (SELECT COUNT(*) FROM employee_attendance WHERE work_date = date('now')) AS present_today,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'Pending') AS pending_leave,
        (SELECT COUNT(*) FROM performance_reviews) AS reviews_total,
        (SELECT COALESCE(AVG(rating), 0) FROM performance_reviews WHERE rating IS NOT NULL) AS avg_rating,
        (SELECT COALESCE(SUM(net_pay), 0) FROM payroll_records) AS payroll_committed
    `).get();
    res.json(totals);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;