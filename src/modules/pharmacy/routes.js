import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';

const router = Router();
const PRESCRIPTION_STATUSES = ['ORDERED', 'REVIEW_PENDING', 'APPROVED', 'DISPENSING', 'DISPENSED', 'REJECTED'];
const ALLOWED_TRANSITIONS = {
  ORDERED: ['REVIEW_PENDING', 'REJECTED'],
  REVIEW_PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['DISPENSING', 'REJECTED'],
  DISPENSING: ['DISPENSED'],
  DISPENSED: [],
  REJECTED: [],
};

const medicationSchema = z.object({
  name: z.string().min(1),
  generic_name: z.string().optional(),
  strength: z.string().optional(),
  form: z.enum(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Patch', 'Other']).optional(),
  manufacturer: z.string().optional(),
  unit_price: z.number().positive().optional(),
  requires_prescription: z.boolean().default(true),
  controlled_substance: z.boolean().default(false),
  description: z.string().optional(),
});

const inventorySchema = z.object({
  medication_id: z.number().int().positive(),
  batch_number: z.string().min(1),
  quantity: z.number().int().min(0),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().optional(),
  unit_cost: z.number().positive().optional(),
});

const dispenseSchema = z.object({
  prescription_id: z.number().int().positive(),
  medication_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  instructions: z.string().optional(),
  dispensed_by: z.number().int().positive(),
});

router.get('/medications', authorize(['Pharmacy', 'Admin', 'Doctor', 'Billing']), (req, res) => {
  const medications = db.getDb().prepare('SELECT * FROM medications ORDER BY name').all();
  res.json({ medications });
});

router.post('/medications', authorize(['Pharmacy', 'Admin']), validate('medication'), (req, res) => {
  try {
    const result = db.getDb().prepare(
      'INSERT INTO medications (name, generic_name, strength, form, manufacturer, unit_price, requires_prescription, controlled_substance, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.validated.name, req.validated.generic_name || null, req.validated.strength || null, req.validated.form || null, req.validated.manufacturer || null, req.validated.unit_price || null, req.validated.requires_prescription ? 1 : 0, req.validated.controlled_substance ? 1 : 0, req.validated.description || null);
    const medication = db.getDb().prepare('SELECT * FROM medications WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, medication });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/inventory', authorize(['Pharmacy', 'Admin']), (req, res) => {
  const inventory = db.getDb().prepare(
    'SELECT i.*, m.name as medication_name, m.strength, m.form FROM pharmacy_inventory i JOIN medications m ON i.medication_id = m.id ORDER BY m.name, i.expiry_date'
  ).all();
  res.json({ inventory });
});

router.post('/inventory', authorize(['Pharmacy', 'Admin']), validate('inventory'), (req, res) => {
  try {
    const result = db.getDb().prepare(
      'INSERT INTO pharmacy_inventory (medication_id, batch_number, quantity, expiry_date, location, unit_cost) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.validated.medication_id, req.validated.batch_number, req.validated.quantity, req.validated.expiry_date, req.validated.location || null, req.validated.unit_cost || null);
    const item = db.getDb().prepare('SELECT * FROM pharmacy_inventory WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/queue', authorize(['Pharmacy', 'Admin']), (req, res) => {
  const queue = db.getDb().prepare(
    `SELECT p.*, c.diagnosis, d.full_name as doctor_name
     FROM prescriptions p
     LEFT JOIN consultations c ON p.consultation_id = c.id
     LEFT JOIN users d ON p.prescribing_doctor_id = d.id
     WHERE p.status IN ('ORDERED', 'REVIEW_PENDING', 'APPROVED', 'DISPENSING')
     ORDER BY p.created_at ASC`
  ).all();
  res.json({ queue, count: queue.length });
});

router.put('/:prescriptionId/status', authorize(['Pharmacy', 'Admin']), (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    if (!PRESCRIPTION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid prescription status' });
    }

    const prescription = db.getDb().prepare('SELECT * FROM prescriptions WHERE id = ?').get(req.params.prescriptionId);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (!ALLOWED_TRANSITIONS[prescription.status]?.includes(status)) {
      return res.status(400).json({ error: `Cannot change status from ${prescription.status} to ${status}` });
    }

    db.getDb().prepare(
      'UPDATE prescriptions SET status = ?, rejection_reason = ? WHERE id = ?'
    ).run(status, status === 'REJECTED' ? rejection_reason || null : null, prescription.id);

    const message = status === 'REJECTED'
      ? `${prescription.medication_name} prescription was rejected${rejection_reason ? `: ${rejection_reason}` : ''}`
      : `${prescription.medication_name} prescription is now ${status}`;
    db.createNotification({
      recipient_id: prescription.prescribing_doctor_id,
      type: 'PRESCRIPTION_STATUS_UPDATE',
      title: 'Prescription Status Update',
      message,
      related_entity: 'prescription',
      related_entity_id: prescription.id,
    });
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'UPDATE_STATUS',
      resource_type: 'prescription',
      resource_id: prescription.id,
      details: `Status changed from ${prescription.status} to ${status}`,
      ip_address: req.ip,
    });
    res.json({ success: true, prescription_id: prescription.id, old_status: prescription.status, new_status: status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/prescriptions/:patientId', authorize(['Pharmacy', 'Admin', 'Doctor', 'Billing']), (req, res) => {
  const prescriptions = db.getDb().prepare(
    'SELECT p.*, c.diagnosis, d.first_name as doctor_first, d.last_name as doctor_last FROM prescriptions p JOIN consultations c ON p.consultation_id = c.id JOIN users d ON p.prescribing_doctor_id = d.id WHERE p.patient_id = ? AND p.dispensed = 0 ORDER BY p.created_at DESC'
  ).all(req.params.patientId);
  res.json({ prescriptions });
});

router.post('/dispense', authorize(['Pharmacy', 'Admin']), validate('dispense'), (req, res) => {
  try {
    const prescription = db.getDb().prepare('SELECT * FROM prescriptions WHERE id = ?').get(req.validated.prescription_id);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (prescription.status !== 'APPROVED' && prescription.status !== 'DISPENSING') {
      return res.status(400).json({ error: 'Prescription must be approved before dispensing' });
    }

    const inventory = db.getDb().prepare('SELECT * FROM pharmacy_inventory WHERE medication_id = ? AND quantity >= ? ORDER BY expiry_date ASC LIMIT 1').get(req.validated.medication_id, req.validated.quantity);
    if (!inventory) return res.status(400).json({ error: 'Insufficient stock' });

    db.getDb().prepare('UPDATE pharmacy_inventory SET quantity = quantity - ? WHERE id = ?').run(req.validated.quantity, inventory.id);
    db.getDb().prepare('UPDATE prescriptions SET status = \'DISPENSED\', dispensed = 1, dispensed_at = CURRENT_TIMESTAMP, dispensed_by = ? WHERE id = ?').run(req.user.id, req.validated.prescription_id);

    db.getDb().prepare(
      'INSERT INTO pharmacy_dispensing (prescription_id, medication_id, quantity, instructions, dispensed_by) VALUES (?, ?, ?, ?, ?)'
    ).run(req.validated.prescription_id, req.validated.medication_id, req.validated.quantity, req.validated.instructions || null, req.user.id);

    db.createNotification({
      recipient_id: prescription.prescribing_doctor_id,
      type: 'PRESCRIPTION_DISPENSED',
      title: 'Prescription Dispensed',
      message: `${prescription.medication_name} has been dispensed`,
      related_entity: 'prescription',
      related_entity_id: prescription.id,
    });
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'DISPENSE',
      resource_type: 'prescription',
      resource_id: prescription.id,
      details: `Dispensed ${req.validated.quantity} units of ${prescription.medication_name}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Medication dispensed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/dispensing-history/:patientId', authorize(['Pharmacy', 'Admin', 'Doctor', 'Billing']), (req, res) => {
  const history = db.getDb().prepare(
    'SELECT pd.*, m.name as medication_name, m.strength, m.form FROM pharmacy_dispensing pd JOIN medications m ON pd.medication_id = m.id WHERE pd.patient_id = ? ORDER BY pd.dispensed_at DESC'
  ).all(req.params.patientId);
  res.json({ history });
});

router.get('/low-stock', authorize(['Pharmacy', 'Admin']), (req, res) => {
  const threshold = parseInt(req.query.threshold) || 10;
  const items = db.getDb().prepare(
    'SELECT i.*, m.name as medication_name FROM pharmacy_inventory i JOIN medications m ON i.medication_id = m.id WHERE i.quantity <= ? ORDER BY i.quantity ASC'
  ).all(threshold);
  res.json({ low_stock: items });
});

router.get('/expiring', authorize(['Pharmacy', 'Admin']), (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const items = db.getDb().prepare(
    'SELECT i.*, m.name as medication_name FROM pharmacy_inventory i JOIN medications m ON i.medication_id = m.id WHERE i.expiry_date <= DATE("now", ? || " days") ORDER BY i.expiry_date ASC'
  ).all(`+${days}`);
  res.json({ expiring_soon: items });
});

export default router;