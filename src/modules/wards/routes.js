import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';

const router = Router();

const wardSchema = z.object({
  name: z.string().min(1),
  building: z.string().optional(),
  floor: z.number().int().optional(),
  ward_type: z.enum(['General', 'ICU', 'NICU', 'PICU', 'Emergency', 'Maternity', 'Psychiatric', 'Isolation', 'Recovery']).optional(),
  capacity: z.number().int().positive().optional(),
  nursing_station_phone: z.string().optional(),
});

const roomSchema = z.object({
  ward_id: z.number().int().positive(),
  room_number: z.string().min(1),
  room_type: z.enum(['General', 'Private', 'ICU', 'Isolation', 'Procedure', 'Consultation']).optional(),
  capacity: z.number().int().positive().default(1),
});

const bedSchema = z.object({
  ward_name: z.string().min(1),
  bed_number: z.string().min(1),
  bed_type: z.enum(['General', 'Private', 'ICU', 'Isolation']),
  status: z.enum(['Available', 'Occupied', 'Reserved', 'Maintenance']).default('Available'),
});

// Wards
router.get('/', authorize('Admin', 'SuperAdmin', 'Doctor', 'Nurse', 'WardStaff', 'Receptionist'), (req, res) => {
  try {
    const wards = db.getAllWards(req.query.active !== 'false');
    res.json({ wards });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authorize('Admin', 'SuperAdmin', 'Doctor', 'Nurse', 'WardStaff', 'Receptionist'), (req, res) => {
  try {
    const ward = db.getWardById(parseInt(req.params.id));
    if (!ward) return res.status(404).json({ error: 'Ward not found' });
    res.json({ ward });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authorize('Admin', 'SuperAdmin'), validate('ward'), (req, res) => {
  try {
    const existing = db.getDb().prepare('SELECT id FROM wards WHERE name = ?').get(req.validated.name);
    if (existing) return res.status(409).json({ error: 'Ward name already exists' });
    
    const result = db.createWard(req.validated);
    const ward = db.getWardById(result.lastInsertRowid);
    res.status(201).json({ success: true, ward });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ward = db.getWardById(id);
    if (!ward) return res.status(404).json({ error: 'Ward not found' });
    
    db.updateWard(id, req.body);
    const updated = db.getWardById(id);
    res.json({ success: true, ward: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rooms
router.get('/:wardId/rooms', authorize('Admin', 'SuperAdmin', 'Doctor', 'Nurse', 'WardStaff', 'Receptionist'), (req, res) => {
  try {
    const rooms = db.getRoomsByWard(parseInt(req.params.wardId), req.query.active !== 'false');
    res.json({ rooms });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/rooms/:id', authorize('Admin', 'SuperAdmin', 'Doctor', 'Nurse', 'WardStaff', 'Receptionist'), (req, res) => {
  try {
    const room = db.getRoomById(parseInt(req.params.id));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/rooms', authorize('Admin', 'SuperAdmin'), validate('room'), (req, res) => {
  try {
    const existing = db.getDb().prepare('SELECT id FROM rooms WHERE ward_id = ? AND room_number = ?').get(req.validated.ward_id, req.validated.room_number);
    if (existing) return res.status(409).json({ error: 'Room number already exists in this ward' });
    
    const result = db.createRoom(req.validated);
    const room = db.getRoomById(result.lastInsertRowid);
    res.status(201).json({ success: true, room });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/rooms/:id', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const room = db.getRoomById(id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    db.updateRoom(id, req.body);
    const updated = db.getRoomById(id);
    res.json({ success: true, room: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ward Beds (enhanced)
router.get('/beds', authorize('Admin', 'SuperAdmin', 'Doctor', 'Nurse', 'WardStaff', 'Receptionist'), (req, res) => {
  try {
    const wardId = req.query.ward_id ? parseInt(req.query.ward_id) : null;
    const beds = db.getWardBedsWithDetails(wardId);
    res.json({ beds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create bed
router.post('/beds', authorize('Admin', 'SuperAdmin'), validate('bed'), (req, res) => {
  try {
    const existing = db.getDb().prepare('SELECT id FROM ward_beds WHERE bed_number = ?').get(req.validated.bed_number);
    if (existing) return res.status(409).json({ error: 'Bed number already exists' });
    
    const result = db.createWardBed(req.validated);
    res.status(201).json({ success: true, bed_id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update bed status
router.put('/beds/:id/status', authorize('Admin', 'SuperAdmin', 'Nurse', 'WardStaff'), (req, res) => {
  try {
    const { status, patient_id } = req.body;
    if (!['Available', 'Occupied', 'Reserved', 'Maintenance'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    db.updateBedStatus(parseInt(req.params.id), status, patient_id || null);
    const bed = db.getBedById(parseInt(req.params.id));
    
    if (status === 'Occupied' && patient_id) {
      db.createAuditLog({
        actor_id: req.user.id,
        action: 'ADMIT',
        resource_type: 'bed',
        resource_id: bed.id,
        details: `Patient ${patient_id} admitted to bed ${bed.bed_number} in ${bed.ward_name}`,
        ip_address: req.ip,
      });
    } else if (status === 'Available' && bed.patient_id) {
      db.createAuditLog({
        actor_id: req.user.id,
        action: 'DISCHARGE',
        resource_type: 'bed',
        resource_id: bed.id,
        details: `Bed ${bed.bed_number} in ${bed.ward_name} is now available`,
        ip_address: req.ip,
      });
    }
    
    res.json({ success: true, bed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get bed occupancy stats
router.get('/stats/occupancy', authorize('Admin', 'SuperAdmin', 'Doctor', 'Nurse'), (req, res) => {
  try {
    const db2 = db.getDb();
    const stats = db2.prepare(`
      SELECT 
        w.name as ward_name,
        w.capacity,
        COUNT(wb.id) as total_beds,
        SUM(CASE WHEN wb.status = 'Occupied' THEN 1 ELSE 0 END) as occupied_beds,
        SUM(CASE WHEN wb.status = 'Available' THEN 1 ELSE 0 END) as available_beds,
        SUM(CASE WHEN wb.status = 'Reserved' THEN 1 ELSE 0 END) as reserved_beds,
        SUM(CASE WHEN wb.status = 'Maintenance' THEN 1 ELSE 0 END) as maintenance_beds
      FROM wards w
      LEFT JOIN ward_beds wb ON w.name = wb.ward_name
      WHERE w.active = 1
      GROUP BY w.id, w.name, w.capacity
      ORDER BY w.name
    `).all();
    
    res.json({ occupancy: stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;