import { Router } from 'express';
import { authorize, requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';

const router = Router();

const personnelSchema = z.object({
  employee_id: z.string().min(1),
  user_id: z.number().int().positive().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  middle_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['Male', 'Female', 'Other', 'PreferNotToSay']).optional(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employment_status: z.enum(['Active', 'OnLeave', 'Terminated', 'Retired']).default('Active'),
  professional_title: z.string().optional(),
  license_number: z.string().optional(),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  department_id: z.number().int().positive().optional(),
  role_id: z.number().int().positive().optional(),
  supervisor_id: z.number().int().positive().optional(),
  work_schedule: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

// Get all personnel (Admin, HR)
router.get('/', authorize('Admin', 'HR', 'SuperAdmin'), (req, res) => {
  try {
    const filters = {
      department_id: req.query.department_id ? parseInt(req.query.department_id) : undefined,
      role_id: req.query.role_id ? parseInt(req.query.role_id) : undefined,
      employment_status: req.query.employment_status,
    };
    const personnel = db.getAllPersonnel(filters);
    res.json({ personnel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get personnel by ID
router.get('/:id', authorize('Admin', 'HR', 'SuperAdmin', 'Doctor', 'Nurse'), (req, res) => {
  try {
    const personnel = db.getPersonnelById(parseInt(req.params.id));
    if (!personnel) return res.status(404).json({ error: 'Personnel not found' });
    res.json({ personnel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user's personnel record
router.get('/me/profile', (req, res) => {
  try {
    const personnel = db.getPersonnelByUserId(req.user.id);
    if (!personnel) return res.status(404).json({ error: 'Personnel record not found' });
    res.json({ personnel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create personnel (Admin, HR)
router.post('/', authorize('Admin', 'HR', 'SuperAdmin'), validate('personnel'), (req, res) => {
  try {
    const result = db.createPersonnel(req.validated);
    const personnel = db.getPersonnelById(result.lastInsertRowid);
    res.status(201).json({ success: true, personnel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update personnel (Admin, HR, or self for limited fields)
router.put('/:id', authorize('Admin', 'HR', 'SuperAdmin'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const personnel = db.getPersonnelById(id);
    if (!personnel) return res.status(404).json({ error: 'Personnel not found' });
    
    // If not admin/superadmin, only allow updating own limited fields
    if (!['Admin', 'SuperAdmin', 'HR'].includes(req.user.role)) {
      if (personnel.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Cannot update other personnel records' });
      }
      // Only allow updating contact info, emergency contact, work schedule
      const allowedFields = ['phone', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'work_schedule'];
      const filteredData = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) filteredData[key] = req.body[key];
      }
      db.updatePersonnel(id, filteredData);
    } else {
      db.updatePersonnel(id, req.body);
    }
    
    const updated = db.getPersonnelById(id);
    res.json({ success: true, personnel: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get personnel by department
router.get('/department/:departmentId', authorize('Admin', 'HR', 'SuperAdmin', 'Doctor', 'Nurse'), (req, res) => {
  try {
    const personnel = db.getAllPersonnel({ department_id: parseInt(req.params.departmentId) });
    res.json({ personnel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get personnel by role
router.get('/role/:roleId', authorize('Admin', 'HR', 'SuperAdmin'), (req, res) => {
  try {
    const personnel = db.getAllPersonnel({ role_id: parseInt(req.params.roleId) });
    res.json({ personnel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;