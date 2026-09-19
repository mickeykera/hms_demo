import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();
const STATUSES = ['ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'REPORT_PENDING', 'REPORTED', 'VERIFIED', 'RELEASED', 'CANCELLED'];
const TRANSITIONS = {
  ORDERED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['REPORT_PENDING', 'CANCELLED'],
  REPORT_PENDING: ['REPORTED', 'CANCELLED'],
  REPORTED: ['VERIFIED'],
  VERIFIED: ['RELEASED'],
  RELEASED: [],
  CANCELLED: [],
};

router.post('/order', authorize(['Doctor', 'Admin']), (req, res) => {
  try {
    const { patient_id, modality, body_part, clinical_indication } = req.body;
    if (!patient_id || !modality || !body_part) {
      return res.status(400).json({ error: 'patient_id, modality, and body_part are required' });
    }
    const result = db.getDb().prepare(
      'INSERT INTO imaging_orders (patient_id, ordering_doctor_id, modality, body_part, clinical_indication) VALUES (?, ?, ?, ?, ?)'
    ).run(patient_id, req.user.id, modality, body_part, clinical_indication || null);
    const orderId = result.lastInsertRowid;
    const radiologists = db.getDb().prepare("SELECT id FROM users WHERE role = 'Radiology' AND active = 1").all();
    for (const radiologist of radiologists) {
      db.createNotification({
        recipient_id: radiologist.id,
        type: 'IMAGING_ORDER_CREATED',
        title: 'New Imaging Order',
        message: `${modality} ordered for patient ${patient_id}`,
        related_entity: 'imaging_order',
        related_entity_id: orderId,
      });
    }
    db.createAuditLog({ actor_id: req.user.id, action: 'CREATE', resource_type: 'imaging_order', resource_id: orderId, details: `Ordered ${modality} for patient ${patient_id}`, ip_address: req.ip });
    res.status(201).json({ success: true, order: db.getDb().prepare('SELECT * FROM imaging_orders WHERE id = ?').get(orderId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/queue', authorize(['Radiology', 'Admin']), (req, res) => {
  const queue = db.getDb().prepare(
    `SELECT io.*, p.first_name, p.last_name, p.global_id, u.full_name AS doctor_name
     FROM imaging_orders io JOIN patients p ON io.patient_id = p.id
     LEFT JOIN users u ON io.ordering_doctor_id = u.id
     WHERE io.status NOT IN ('RELEASED', 'CANCELLED') ORDER BY io.ordered_at ASC`
  ).all();
  res.json({ queue, count: queue.length });
});

router.put('/:orderId/status', authorize(['Radiology', 'Admin']), (req, res) => {
  try {
    const { status, scheduled_at } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid imaging status' });
    const order = db.getDb().prepare('SELECT * FROM imaging_orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Imaging order not found' });
    if (!TRANSITIONS[order.status].includes(status)) return res.status(400).json({ error: `Cannot change status from ${order.status} to ${status}` });
    db.getDb().prepare('UPDATE imaging_orders SET status = ?, scheduled_at = COALESCE(?, scheduled_at), completed_at = CASE WHEN ? IN (\'REPORTED\', \'RELEASED\') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?').run(status, scheduled_at || null, status, order.id);
    db.createNotification({ recipient_id: order.ordering_doctor_id, type: 'IMAGING_STATUS_UPDATE', title: 'Imaging Status Update', message: `${order.modality} is now ${status}`, related_entity: 'imaging_order', related_entity_id: order.id });
    db.createAuditLog({ actor_id: req.user.id, action: 'UPDATE_STATUS', resource_type: 'imaging_order', resource_id: order.id, details: `Status changed from ${order.status} to ${status}`, ip_address: req.ip });
    res.json({ success: true, old_status: order.status, new_status: status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:orderId/report', authorize(['Radiology', 'Admin']), (req, res) => {
  try {
    const { findings, impression } = req.body;
    if (!findings) return res.status(400).json({ error: 'findings are required' });
    const order = db.getDb().prepare('SELECT * FROM imaging_orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Imaging order not found' });
    if (!['REPORT_PENDING', 'IN_PROGRESS'].includes(order.status)) return res.status(400).json({ error: 'Imaging order is not ready for reporting' });
    const result = db.getDb().prepare('INSERT INTO imaging_reports (imaging_order_id, findings, impression, reported_by) VALUES (?, ?, ?, ?)').run(order.id, findings, impression || null, req.user.id);
    db.getDb().prepare('UPDATE imaging_orders SET status = \'REPORTED\' WHERE id = ?').run(order.id);
    db.createNotification({ recipient_id: order.ordering_doctor_id, type: 'IMAGING_REPORT_READY', title: 'Imaging Report Ready', message: `${order.modality} report is ready for review`, related_entity: 'imaging_report', related_entity_id: result.lastInsertRowid });
    db.createAuditLog({ actor_id: req.user.id, action: 'CREATE_REPORT', resource_type: 'imaging_report', resource_id: result.lastInsertRowid, details: `Report entered for imaging order ${order.id}`, ip_address: req.ip });
    res.status(201).json({ success: true, report_id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
