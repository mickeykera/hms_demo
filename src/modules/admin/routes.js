import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();

/**
 * Aggregate system statistics for the administration dashboard.
 *
 * The frontend previously called `/api/admin/stats`, which never existed and
 * returned 404, so every admin/superadmin figure rendered as zero. This
 * endpoint computes the same numbers server-side in a single pass.
 */
router.get(
  '/stats',
  authorize(['SuperAdmin', 'Admin', 'DepartmentAdmin']),
  (req, res) => {
    try {
      const database = db.getDb();
      const one = (sql, ...params) => database.prepare(sql).get(...params);

      const totalUsers = one('SELECT COUNT(*) AS n FROM users').n;
      const activeUsers = one("SELECT COUNT(*) AS n FROM users WHERE active = 1").n;
      const totalPatients = one('SELECT COUNT(*) AS n FROM patients').n;
      const totalAppointments = one('SELECT COUNT(*) AS n FROM appointments').n;

      const todayAppointments = one(
        "SELECT COUNT(*) AS n FROM appointments WHERE DATE(scheduled_date) = DATE('now')"
      ).n;

      const totalBeds = one('SELECT COUNT(*) AS n FROM ward_beds').n;
      const occupiedBeds = one(
        "SELECT COUNT(*) AS n FROM ward_beds WHERE status = 'Occupied'"
      ).n;
      const occupancyRate = totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      const revenue = one(
        "SELECT COALESCE(SUM(total_amount), 0) AS n FROM invoices WHERE status = 'Paid'"
      ).n;
      const outstanding = one(
        "SELECT COALESCE(SUM(balance), 0) AS n FROM invoices WHERE status IN ('Unpaid','Partial')"
      ).n;

      const totalStaff = one('SELECT COUNT(*) AS n FROM personnel').n;
      const pendingLabTests = one(
        "SELECT COUNT(*) AS n FROM lab_tests WHERE status IN ('Ordered','CollectionPending','Collected','InProgress')"
      ).n;
      const criticalResults = one(
        "SELECT COUNT(*) AS n FROM lab_results WHERE flagged = 1"
      ).n;

      res.json({
        total_users: totalUsers,
        active_users: activeUsers,
        total_patients: totalPatients,
        total_appointments: totalAppointments,
        today_appointments: todayAppointments,
        total_beds: totalBeds,
        occupied_beds: occupiedBeds,
        occupancy_rate: occupancyRate,
        revenue_today: revenue,
        outstanding: outstanding,
        total_staff: totalStaff,
        pending_lab_tests: pendingLabTests,
        critical_results: criticalResults,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);


/**
 * Key/value system settings.
 *
 * Backs the administration "System settings" tab. Reads are open to any
 * admin-level role; writes are SuperAdmin only, since these values affect
 * hospital-wide behaviour.
 */
router.get('/settings', authorize(['Admin', 'SuperAdmin']), (req, res) => {
  try {
    const settings = db.getDb().prepare(
      'SELECT key, value, category, updated_at FROM system_settings ORDER BY category, key'
    ).all();
    res.json({ settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/settings/:key', authorize(['SuperAdmin']), (req, res) => {
  try {
    const key = String(req.params.key);
    const { value, category } = req.body;
    db.getDb().prepare(`
      INSERT INTO system_settings (key, value, category, updated_by, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, value ?? null, category || 'General', req.user.id);
    res.json({
      success: true,
      setting: db.getDb().prepare('SELECT key, value, category, updated_at FROM system_settings WHERE key = ?').get(key),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
