import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';

const router = Router();

const departmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  description: z.string().optional(),
  parent_department_id: z.number().int().positive().optional(),
});

// Get all departments
router.get('/', authorize('Admin', 'SuperAdmin', 'HR', 'Finance', 'DepartmentAdmin', 'Doctor', 'Nurse', 'Receptionist'), (req, res) => {
  try {
    const departments = db.getAllDepartments();
    res.json({ departments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get department by ID
router.get('/:id', authorize('Admin', 'SuperAdmin', 'HR', 'Finance', 'DepartmentAdmin', 'Doctor', 'Nurse'), (req, res) => {
  try {
    const department = db.getDepartmentById(parseInt(req.params.id));
    if (!department) return res.status(404).json({ error: 'Department not found' });
    res.json({ department });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get department by code
router.get('/code/:code', authorize('Admin', 'SuperAdmin', 'HR', 'Finance', 'DepartmentAdmin', 'Doctor', 'Nurse'), (req, res) => {
  try {
    const department = db.getDepartmentByCode(req.params.code);
    if (!department) return res.status(404).json({ error: 'Department not found' });
    res.json({ department });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create department (Admin, SuperAdmin)
router.post('/', authorize('Admin', 'SuperAdmin'), validate('department'), (req, res) => {
  try {
    const existing = db.getDepartmentByCode(req.validated.code);
    if (existing) return res.status(409).json({ error: 'Department code already exists' });
    
    const result = db.createDepartment(req.validated);
    const department = db.getDepartmentById(result.lastInsertRowid);
    res.status(201).json({ success: true, department });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update department (Admin, SuperAdmin)
router.put('/:id', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const department = db.getDepartmentById(id);
    if (!department) return res.status(404).json({ error: 'Department not found' });
    
    db.updateDepartment(id, req.body);
    const updated = db.getDepartmentById(id);
    res.json({ success: true, department: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get department personnel
router.get('/:id/personnel', authorize('Admin', 'SuperAdmin', 'HR', 'DepartmentAdmin'), (req, res) => {
  try {
    const personnel = db.getAllPersonnel({ department_id: parseInt(req.params.id) });
    res.json({ personnel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;