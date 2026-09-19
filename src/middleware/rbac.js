import { getDb, getPermissionsForRoleName, getPersonnelByUserId } from '../models/index.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const ROLE_HIERARCHY = {
  SuperAdmin: 10,
  Admin: 9,
  DepartmentAdmin: 7,
  Doctor: 6,
  Emergency: 5,
  Nurse: 5,
  LabTech: 4,
  Pharmacy: 4,
  Radiology: 4,
  OperatingRoom: 4,
  Billing: 4,
  HR: 4,
  Finance: 4,
  Receptionist: 3,
  WardStaff: 3,
  Inventory: 3,
  Patient: 1,
};

const MODULE_PERMISSIONS = {
  Reception: ['Receptionist', 'Admin', 'DepartmentAdmin', 'Doctor', 'SuperAdmin'],
  Clinical: ['Doctor', 'Nurse', 'Admin', 'DepartmentAdmin', 'SuperAdmin'],
  Billing: ['Billing', 'Admin', 'Finance', 'DepartmentAdmin', 'Doctor', 'SuperAdmin'],
  Laboratory: ['LabTech', 'Doctor', 'Admin', 'DepartmentAdmin', 'SuperAdmin'],
  Radiology: ['Radiology', 'Doctor', 'Admin', 'DepartmentAdmin', 'SuperAdmin'],
  Pharmacy: ['Pharmacy', 'Admin', 'DepartmentAdmin', 'Doctor', 'Billing', 'SuperAdmin'],
  Ward: ['Nurse', 'WardStaff', 'Doctor', 'Admin', 'DepartmentAdmin', 'SuperAdmin'],
  IoT: ['Admin', 'SuperAdmin', 'Doctor', 'Nurse'],
  OR: ['Doctor', 'Admin', 'OperatingRoom', 'DepartmentAdmin', 'SuperAdmin'],
  Appointments: ['Doctor', 'Receptionist', 'Nurse', 'Admin', 'DepartmentAdmin', 'SuperAdmin', 'Patient'],
  Patient: ['Patient'],
  Messages: ['Doctor', 'Nurse', 'Receptionist', 'Admin', 'DepartmentAdmin', 'SuperAdmin'],
  Administration: ['Admin', 'DepartmentAdmin', 'SuperAdmin', 'HR', 'Finance'],
  Inventory: ['Inventory', 'Admin', 'DepartmentAdmin', 'Pharmacy', 'SuperAdmin'],
  HR: ['HR', 'Admin', 'SuperAdmin'],
  Finance: ['Finance', 'Admin', 'SuperAdmin', 'Billing'],
};

function getDatabasePermissionsForRole(roleName) {
  if (roleName === 'SuperAdmin') {
    const db = getDb();
    return db.prepare('SELECT name FROM permissions').all().map(p => p.name);
  }
  if (roleName === 'Patient') {
    return ['PATIENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_EDIT', 'MEDICAL_RECORD_VIEW', 'LAB_RESULT_VIEW', 'IMAGING_RESULT_VIEW', 'PRESCRIPTION_VIEW', 'BILLING_VIEW'];
  }
  const dbPerms = getPermissionsForRoleName(roleName).map(p => p.name);
  // Fallback to static MODULE_PERMISSIONS if no database permissions found
  if (dbPerms.length === 0) {
    return Object.entries(MODULE_PERMISSIONS)
      .filter(([, allowedRoles]) => allowedRoles.includes(roleName))
      .map(([moduleName]) => moduleName);
  }
  return dbPerms;
}

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing authorization header' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found or inactive' });

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    // Get personnel record if exists
    const personnel = user.personnel_id ? db.prepare('SELECT * FROM personnel WHERE id = ?').get(user.personnel_id) : null;
    
    // Get granular permissions for this user's role from database
    const permissionNames = getDatabasePermissionsForRole(user.role);
    
    req.user = { ...user, personnel, permissions: permissionNames };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...allowedRoles) {
  // Flatten in case an array was passed as first argument
  const roles = allowedRoles.length === 1 && Array.isArray(allowedRoles[0]) ? allowedRoles[0] : allowedRoles;
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SuperAdmin') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Role '${req.user.role}' not authorized. Required: ${roles.join(', ')}` });
    }
    next();
  };
}

export function authorizeModule(moduleName) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SuperAdmin') return next();
    const allowed = MODULE_PERMISSIONS[moduleName] || [];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: `Role '${req.user.role}' cannot access ${moduleName} module` });
    }
    next();
  };
}

export function requirePermission(...permissionNames) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SuperAdmin') return next();
    
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissionNames.some(p => userPermissions.includes(p));
    
    if (!hasPermission) {
      return res.status(403).json({ error: `Insufficient permissions. Required: ${permissionNames.join(' or ')}` });
    }
    next();
  };
}

export function requireAnyPermission(...permissionNames) {
  return requirePermission(...permissionNames);
}

export function requireAllPermissions(...permissionNames) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SuperAdmin') return next();
    
    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = permissionNames.every(p => userPermissions.includes(p));
    
    if (!hasAllPermissions) {
      return res.status(403).json({ error: `Insufficient permissions. Required all: ${permissionNames.join(', ')}` });
    }
    next();
  };
}

export function getPermissionsForRole(role) {
  return getDatabasePermissionsForRole(role);
}

export function checkPatientAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'SuperAdmin' || req.user.role === 'Admin') return next();
  
  const patientId = parseInt(req.params.patientId || req.params.id || req.body.patient_id);
  if (!patientId) return next();
  
  const db = getDb();
  
  // Check if user is a patient accessing their own record
  if (req.user.role === 'Patient') {
    const userPatient = db.prepare('SELECT patient_id FROM users WHERE id = ?').get(req.user.id);
    if (userPatient && userPatient.patient_id === patientId) return next();
    return res.status(403).json({ error: 'You can only access your own records' });
  }
  
  // For clinical staff, check if they have assignment or department access
  if (['Doctor', 'Nurse', 'Emergency'].includes(req.user.role)) {
    // Check direct assignment
    const assignment = db.prepare('SELECT 1 FROM patient_doctor WHERE doctor_id = ? AND patient_id = ? AND active = 1').get(req.user.id, patientId);
    if (assignment) return next();
    
    // Check department-based access (doctor's department matches patient's current/assigned department)
    const personnel = req.user.personnel;
    if (personnel?.department_id) {
      // Check if patient is currently in a visit/encounter in this department
      const visit = db.prepare('SELECT 1 FROM visits WHERE patient_id = ? AND department = (SELECT name FROM departments WHERE id = ?) AND status IN (?, ?)').get(patientId, personnel.department_id, 'Waiting', 'InConsultation');
      if (visit) return next();
      
      // Check if patient is admitted to a ward in this department
      const admission = db.prepare(`
        SELECT 1 FROM admissions a 
        JOIN ward_beds wb ON a.bed_id = wb.id 
        JOIN wards w ON wb.ward_name = w.name
        WHERE a.patient_id = ? AND a.status = 'Admitted' AND w.id = ?
      `).get(patientId, personnel.department_id);
      if (admission) return next();
    }
    
    // Check if user has referral/consultation access
    const referral = db.prepare('SELECT 1 FROM patient_doctor WHERE doctor_id = ? AND patient_id = ? AND assignment_type IN (?, ?) AND active = 1').get(req.user.id, patientId, 'Consulting', 'Referral');
    if (referral) return next();
  }
  
  // For lab/radiology/pharmacy - check if they have pending requests for this patient
  if (['LabTech', 'Radiology', 'Pharmacy'].includes(req.user.role)) {
    const hasRequest = db.prepare(`
      SELECT 1 FROM department_requests 
      WHERE patient_id = ? AND receiving_department_id = (
        SELECT id FROM departments WHERE code = ?
      ) AND status IN (?, ?, ?)
    `).get(patientId, 
      req.user.role === 'LabTech' ? 'LAB' : 
      req.user.role === 'Radiology' ? 'RAD' : 'PHARM',
      'Pending', 'Accepted', 'InProgress'
    );
    if (hasRequest) return next();
  }
  
  // For billing - can access if patient has invoices
  if (['Billing', 'Finance'].includes(req.user.role)) {
    const hasInvoice = db.prepare('SELECT 1 FROM invoices WHERE patient_id = ?').get(patientId);
    if (hasInvoice) return next();
  }
  
  return res.status(403).json({ error: 'You do not have access to this patient\'s records' });
}

export function checkDepartmentAccess(departmentCode) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SuperAdmin' || req.user.role === 'Admin') return next();
    
    const personnel = req.user.personnel;
    if (!personnel?.department_id) {
      return res.status(403).json({ error: 'No department assigned' });
    }
    
    const db = getDb();
    const dept = db.prepare('SELECT id FROM departments WHERE code = ?').get(departmentCode);
    if (!dept) return next(); // Allow if department code not found
    
    if (personnel.department_id !== dept.id) {
      return res.status(403).json({ error: 'You do not have access to this department' });
    }
    next();
  };
}

// Check if user's role is at or above a certain hierarchy level
export function requireRoleLevel(minLevel) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    if (userLevel < minLevel) {
      return res.status(403).json({ error: `Insufficient role level. Required: ${minLevel}, Current: ${userLevel}` });
    }
    next();
  };
}

// Flexible authorization: check role OR permission
export function authorizeOrPermission(allowedRoles, permissionNames) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SuperAdmin') return next();
    
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const perms = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
    
    const hasRole = roles.includes(req.user.role);
    const userPermissions = req.user.permissions || [];
    const hasPermission = perms.some(p => userPermissions.includes(p));
    
    if (!hasRole && !hasPermission) {
      return res.status(403).json({ 
        error: `Access denied. Required role: ${roles.join(' or ')} or permission: ${perms.join(' or ')}` 
      });
    }
    next();
  };
}

// Resource-scoped permission check (e.g., user can only access patients in their department)
export function requireScopedPermission(permissionName, scopeChecker) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SuperAdmin') return next();
    
    const userPermissions = req.user.permissions || [];
    if (!userPermissions.includes(permissionName)) {
      return res.status(403).json({ error: `Insufficient permissions. Required: ${permissionName}` });
    }
    
    // Check scope (e.g., department, assigned patients, etc.)
    if (scopeChecker && !scopeChecker(req)) {
      return res.status(403).json({ error: 'Access denied for this resource scope' });
    }
    
    next();
  };
}

// Check if user can access a specific patient's data (more comprehensive)
export function checkPatientScope(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'SuperAdmin' || req.user.role === 'Admin') return next();
  
  const patientId = parseInt(req.params.patientId || req.params.id || req.body.patient_id);
  if (!patientId) return next();
  
  const db = getDb();
  
  // Patient can only access their own records
  if (req.user.role === 'Patient') {
    const userPatient = db.prepare('SELECT patient_id FROM users WHERE id = ?').get(req.user.id);
    if (userPatient && userPatient.patient_id === patientId) return next();
    return res.status(403).json({ error: 'You can only access your own records' });
  }
  
  // Clinical staff - check various access paths
  if (['Doctor', 'Nurse', 'Emergency'].includes(req.user.role)) {
    // Direct assignment
    const assignment = db.prepare('SELECT 1 FROM patient_doctor WHERE doctor_id = ? AND patient_id = ? AND active = 1').get(req.user.id, patientId);
    if (assignment) return next();
    
    // Department-based access
    const personnel = req.user.personnel;
    if (personnel?.department_id) {
      // Check active visit in this department
      const visit = db.prepare(
        'SELECT 1 FROM visits WHERE patient_id = ? AND department = (SELECT name FROM departments WHERE id = ?) AND status IN (?, ?)'
      ).get(patientId, personnel.department_id, 'Waiting', 'InConsultation');
      if (visit) return next();
      
      // Check admission in ward belonging to this department
      const admission = db.prepare(`
        SELECT 1 FROM admissions a 
        JOIN ward_beds wb ON a.bed_id = wb.id 
        JOIN wards w ON wb.ward_name = w.name
        WHERE a.patient_id = ? AND a.status = 'Admitted' AND w.id = ?
      `).get(patientId, personnel.department_id);
      if (admission) return next();
    }
    
    // Referral/Consultation access
    const referral = db.prepare(
      'SELECT 1 FROM patient_doctor WHERE doctor_id = ? AND patient_id = ? AND assignment_type IN (?, ?) AND active = 1'
    ).get(req.user.id, patientId, 'Consulting', 'Referral');
    if (referral) return next();
  }
  
  // Lab/Radiology/Pharmacy - check pending requests
  if (['LabTech', 'Radiology', 'Pharmacy'].includes(req.user.role)) {
    const deptCode = req.user.role === 'LabTech' ? 'LAB' : 
                     req.user.role === 'Radiology' ? 'RAD' : 'PHARM';
    const hasRequest = db.prepare(`
      SELECT 1 FROM department_requests 
      WHERE patient_id = ? AND receiving_department_id = (SELECT id FROM departments WHERE code = ?)
      AND status IN (?, ?, ?)
    `).get(patientId, deptCode, 'Pending', 'Accepted', 'InProgress');
    if (hasRequest) return next();
  }
  
  // Billing/Finance - check invoices
  if (['Billing', 'Finance'].includes(req.user.role)) {
    const hasInvoice = db.prepare('SELECT 1 FROM invoices WHERE patient_id = ?').get(patientId);
    if (hasInvoice) return next();
  }
  
  // DepartmentAdmin - access all patients in their department
  if (req.user.role === 'DepartmentAdmin' && req.user.personnel?.department_id) {
    const personnel = req.user.personnel;
    const visit = db.prepare(
      'SELECT 1 FROM visits WHERE patient_id = ? AND department = (SELECT name FROM departments WHERE id = ?)'
    ).get(patientId, personnel.department_id);
    if (visit) return next();
    
    const admission = db.prepare(`
      SELECT 1 FROM admissions a 
      JOIN ward_beds wb ON a.bed_id = wb.id 
      JOIN wards w ON wb.ward_name = w.name
      WHERE a.patient_id = ? AND a.status = 'Admitted' AND w.id = ?
    `).get(patientId, personnel.department_id);
    if (admission) return next();
  }
  
  return res.status(403).json({ error: 'You do not have access to this patient\'s records' });
}

export { ROLE_HIERARCHY, MODULE_PERMISSIONS, getDatabasePermissionsForRole };