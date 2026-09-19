import { Router } from 'express';
import { authorize, requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';

const router = Router();

const auditLogFilterSchema = z.object({
  actor_id: z.coerce.number().int().positive().optional(),
  resource_type: z.string().optional(),
  resource_id: z.coerce.number().int().positive().optional(),
  action: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// Get audit logs with filters
router.get('/', authorize('Admin', 'SuperAdmin', 'HR', 'Finance'), (req, res) => {
  try {
    const filters = {
      actor_id: req.query.actor_id ? parseInt(req.query.actor_id) : undefined,
      resource_type: req.query.resource_type,
      resource_id: req.query.resource_id ? parseInt(req.query.resource_id) : undefined,
      action: req.query.action,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
    };

    let query = 'SELECT al.*, u.username, u.full_name as actor_name, u.role as actor_role FROM audit_logs al LEFT JOIN users u ON al.actor_id = u.id WHERE 1=1';
    const params = [];

    if (filters.actor_id) {
      query += ' AND al.actor_id = ?';
      params.push(filters.actor_id);
    }
    if (filters.resource_type) {
      query += ' AND al.resource_type = ?';
      params.push(filters.resource_type);
    }
    if (filters.resource_id) {
      query += ' AND al.resource_id = ?';
      params.push(filters.resource_id);
    }
    if (filters.action) {
      query += ' AND al.action = ?';
      params.push(filters.action);
    }
    if (filters.start_date) {
      query += ' AND date(al.created_at) >= date(?)';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND date(al.created_at) <= date(?)';
      params.push(filters.end_date);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit, filters.offset);

    const logs = db.getDb().prepare(query).all(...params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1';
    const countParams = [];
    if (filters.actor_id) { countQuery += ' AND al.actor_id = ?'; countParams.push(filters.actor_id); }
    if (filters.resource_type) { countQuery += ' AND al.resource_type = ?'; countParams.push(filters.resource_type); }
    if (filters.resource_id) { countQuery += ' AND al.resource_id = ?'; countParams.push(filters.resource_id); }
    if (filters.action) { countQuery += ' AND al.action = ?'; countParams.push(filters.action); }
    if (filters.start_date) { countQuery += ' AND date(al.created_at) >= date(?)'; countParams.push(filters.start_date); }
    if (filters.end_date) { countQuery += ' AND date(al.created_at) <= date(?)'; countParams.push(filters.end_date); }

    const total = db.getDb().prepare(countQuery).get(...countParams).total;

    res.json({ logs, total, limit: filters.limit, offset: filters.offset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get audit log statistics
router.get('/stats', authorize('Admin', 'SuperAdmin', 'HR', 'Finance'), (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30;
    
    const totalLogs = db.getDb().prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE date(created_at) >= date('now', ?)`).get(`-${days} days`).count;
    
    const byAction = db.getDb().prepare(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE date(created_at) >= date('now', ?)
      GROUP BY action 
      ORDER BY count DESC
    `).all(`-${days} days`);
    
    const byResource = db.getDb().prepare(`
      SELECT resource_type, COUNT(*) as count 
      FROM audit_logs 
      WHERE date(created_at) >= date('now', ?)
      GROUP BY resource_type 
      ORDER BY count DESC
    `).all(`-${days} days`);
    
    const byActor = db.getDb().prepare(`
      SELECT u.role, COUNT(*) as count 
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE date(al.created_at) >= date('now', ?)
      GROUP BY u.role 
      ORDER BY count DESC
    `).all(`-${days} days`);
    
    const byUser = db.getDb().prepare(`
      SELECT u.username, u.full_name, u.role, COUNT(*) as count 
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE date(al.created_at) >= date('now', ?)
      GROUP BY al.actor_id 
      ORDER BY count DESC
      LIMIT 20
    `).all(`-${days} days`);

    const hourlyActivity = db.getDb().prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM audit_logs
      WHERE date(created_at) >= date('now', ?)
      GROUP BY hour
      ORDER BY hour
    `).all(`-${days} days`);

    res.json({ totalLogs, byAction, byResource, byActor, byUser, hourlyActivity });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get audit log for a specific resource
router.get('/resource/:resourceType/:resourceId', authorize('Admin', 'SuperAdmin', 'HR', 'Finance'), (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const logs = db.getDb().prepare(`
      SELECT al.*, u.username, u.full_name as actor_name, u.role as actor_role
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.resource_type = ? AND al.resource_id = ?
      ORDER BY al.created_at DESC
    `).all(resourceType, parseInt(resourceId));
    
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get audit log for a specific user (actor)
router.get('/user/:userId', authorize('Admin', 'SuperAdmin', 'HR'), (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const logs = db.getDb().prepare(`
      SELECT al.*, u.username, u.full_name as actor_name, u.role as actor_role
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.actor_id = ?
      ORDER BY al.created_at DESC
      LIMIT 200
    `).all(userId);
    
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export audit logs (CSV)
router.get('/export', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const filters = {
      actor_id: req.query.actor_id ? parseInt(req.query.actor_id) : undefined,
      resource_type: req.query.resource_type,
      resource_id: req.query.resource_id ? parseInt(req.query.resource_id) : undefined,
      action: req.query.action,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : 10000,
    };

    let query = 'SELECT al.*, u.username, u.full_name as actor_name, u.role as actor_role FROM audit_logs al LEFT JOIN users u ON al.actor_id = u.id WHERE 1=1';
    const params = [];

    if (filters.actor_id) { query += ' AND al.actor_id = ?'; params.push(filters.actor_id); }
    if (filters.resource_type) { query += ' AND al.resource_type = ?'; params.push(filters.resource_type); }
    if (filters.resource_id) { query += ' AND al.resource_id = ?'; params.push(filters.resource_id); }
    if (filters.action) { query += ' AND al.action = ?'; params.push(filters.action); }
    if (filters.start_date) { query += ' AND date(al.created_at) >= date(?)'; params.push(filters.start_date); }
    if (filters.end_date) { query += ' AND date(al.created_at) <= date(?)'; params.push(filters.end_date); }

    query += ' ORDER BY al.created_at DESC LIMIT ?';
    params.push(filters.limit);

    const logs = db.getDb().prepare(query).all(...params);

    // Generate CSV
    const headers = ['ID', 'Timestamp', 'Actor ID', 'Actor Username', 'Actor Name', 'Actor Role', 'Action', 'Resource Type', 'Resource ID', 'Details', 'IP Address'];
    const rows = logs.map(log => [
      log.id,
      log.created_at,
      log.actor_id || '',
      log.username || '',
      log.actor_name || '',
      log.actor_role || '',
      log.action,
      log.resource_type,
      log.resource_id || '',
      log.details ? log.details.replace(/"/g, '""') : '',
      log.ip_address || '',
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;