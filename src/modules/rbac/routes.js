import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';

const router = Router();

const roleSchema = z.object({
  name: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().optional(),
  hierarchy_level: z.number().int().min(1).max(10).default(1),
});

const permissionSchema = z.object({
  name: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
});

const rolePermissionSchema = z.object({
  role_id: z.number().int().positive(),
  permission_id: z.number().int().positive(),
});

// Get all roles
router.get('/roles', authorize('Admin', 'SuperAdmin', 'HR'), (req, res) => {
  try {
    const roles = db.getAllRoles();
    res.json({ roles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get role by ID
router.get('/roles/:id', authorize('Admin', 'SuperAdmin', 'HR'), (req, res) => {
  try {
    const role = db.getRoleById(parseInt(req.params.id));
    if (!role) return res.status(404).json({ error: 'Role not found' });
    
    // Get permissions for this role
    const permissions = db.getPermissionsForRoleName(role.name);
    res.json({ role, permissions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create role
router.post('/roles', authorize('Admin', 'SuperAdmin'), validate('role'), (req, res) => {
  try {
    const existing = db.getRoleByName(req.validated.name);
    if (existing) return res.status(409).json({ error: 'Role already exists' });
    
    const result = db.createRole(req.validated);
    const role = db.getRoleById(result.lastInsertRowid);
    res.status(201).json({ success: true, role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update role
router.put('/roles/:id', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const role = db.getRoleById(id);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    
    const db2 = db.getDb();
    const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(req.body), id];
    db2.prepare(`UPDATE roles SET ${fields} WHERE id = ?`).run(...values);
    
    const updated = db.getRoleById(id);
    res.json({ success: true, role: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all permissions
router.get('/permissions', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const permissions = db.getAllPermissions();
    res.json({ permissions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get permissions by category
router.get('/permissions/category/:category', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const permissions = db.getPermissionsByCategory(req.params.category);
    res.json({ permissions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create permission
router.post('/permissions', authorize('Admin', 'SuperAdmin'), validate('permission'), (req, res) => {
  try {
    const existing = db.getDb().prepare('SELECT id FROM permissions WHERE name = ?').get(req.validated.name);
    if (existing) return res.status(409).json({ error: 'Permission already exists' });
    
    const result = db.createPermission(req.validated);
    const permission = db.getDb().prepare('SELECT * FROM permissions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, permission });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Assign permission to role
router.post('/roles/:roleId/permissions', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const roleId = parseInt(req.params.roleId);
    const { permission_id } = req.body;
    
    if (!permission_id) return res.status(400).json({ error: 'permission_id is required' });
    
    const role = db.getRoleById(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    
    const perm = db.getDb().prepare('SELECT id FROM permissions WHERE id = ?').get(permission_id);
    if (!perm) return res.status(404).json({ error: 'Permission not found' });
    
    db.assignPermissionToRole(roleId, permission_id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove permission from role
router.delete('/roles/:roleId/permissions/:permissionId', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const roleId = parseInt(req.params.roleId);
    const permissionId = parseInt(req.params.permissionId);
    
    db.removePermissionFromRole(roleId, permissionId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get permissions for a role name (for frontend)
router.get('/permissions/role/:roleName', authorize('Admin', 'SuperAdmin', 'HR'), (req, res) => {
  try {
    const permissions = db.getPermissionsForRoleName(req.params.roleName);
    res.json({ permissions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;