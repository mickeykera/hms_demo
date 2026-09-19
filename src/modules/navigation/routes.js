import { Router } from 'express';
import { authenticate } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();

const ROLE_NAVIGATION = {
  SuperAdmin: [
    { label: 'Dashboard', path: '/dashboards/superadmin', icon: 'dashboard', permission: 'REPORT_VIEW' },
    { label: 'Administration', path: '/admin', icon: 'settings', children: [
      { label: 'Users', path: '/admin/users', permission: 'USER_CREATE' },
      { label: 'Roles & Permissions', path: '/admin/roles', permission: 'ROLE_CREATE' },
      { label: 'Departments', path: '/admin/departments', permission: 'DEPARTMENT_MANAGE' },
      { label: 'Audit Logs', path: '/admin/audit-logs', permission: 'AUDIT_LOG_VIEW' },
      { label: 'System Settings', path: '/admin/settings', permission: 'REPORT_EXPORT' },
    ]},
    { label: 'Reports', path: '/reports', icon: 'analytics', permission: 'REPORT_VIEW' },
    { label: 'All Modules', path: '/modules', icon: 'grid', permission: 'REPORT_VIEW' },
  ],
  Admin: [
    { label: 'Dashboard', path: '/dashboards/admin', icon: 'dashboard', permission: 'REPORT_VIEW' },
    { label: 'Administration', path: '/admin', icon: 'settings', children: [
      { label: 'Users', path: '/admin/users', permission: 'USER_CREATE' },
      { label: 'Roles & Permissions', path: '/admin/roles', permission: 'ROLE_CREATE' },
      { label: 'Departments', path: '/admin/departments', permission: 'DEPARTMENT_MANAGE' },
      { label: 'Audit Logs', path: '/admin/audit-logs', permission: 'AUDIT_LOG_VIEW' },
    ]},
    { label: 'Reception', path: '/reception', icon: 'reception', permission: 'PATIENT_CREATE' },
    { label: 'Clinical', path: '/clinical', icon: 'clinical', permission: 'MEDICAL_RECORD_VIEW' },
    { label: 'Billing', path: '/billing', icon: 'billing', permission: 'BILLING_VIEW' },
    { label: 'Laboratory', path: '/laboratory', icon: 'lab', permission: 'LAB_REQUEST_VIEW' },
    { label: 'Radiology', path: '/radiology', icon: 'radiology', permission: 'IMAGING_REQUEST_CREATE' },
    { label: 'Pharmacy', path: '/pharmacy', icon: 'pharmacy', permission: 'PRESCRIPTION_VIEW' },
    { label: 'Wards', path: '/wards', icon: 'wards', permission: 'WARD_MANAGE' },
    { label: 'Operating Room', path: '/or', icon: 'or', permission: 'SCHEDULE_MANAGE' },
    { label: 'Appointments', path: '/appointments', icon: 'calendar', permission: 'APPOINTMENT_CREATE' },
    { label: 'Inventory', path: '/inventory', icon: 'inventory', permission: 'INVENTORY_VIEW' },
    { label: 'HR', path: '/hr', icon: 'hr', permission: 'SCHEDULE_MANAGE' },
    { label: 'Finance', path: '/finance', icon: 'finance', permission: 'REPORT_VIEW' },
    { label: 'Reports', path: '/reports', icon: 'analytics', permission: 'REPORT_VIEW' },
  ],
  DepartmentAdmin: [
    { label: 'Dashboard', path: '/dashboards/department-admin', icon: 'dashboard', permission: 'REPORT_VIEW' },
    { label: 'Department Management', path: '/department', icon: 'department', children: [
      { label: 'Staff', path: '/department/staff', permission: 'SCHEDULE_MANAGE' },
      { label: 'Schedule', path: '/department/schedule', permission: 'SCHEDULE_MANAGE' },
      { label: 'Inventory', path: '/department/inventory', permission: 'INVENTORY_VIEW' },
    ]},
    { label: 'Patients', path: '/patients', icon: 'patients', permission: 'PATIENT_VIEW' },
    { label: 'Requests', path: '/requests', icon: 'requests', permission: 'LAB_REQUEST_CREATE' },
    { label: 'Reports', path: '/reports', icon: 'analytics', permission: 'REPORT_VIEW' },
  ],
  Doctor: [
    { label: 'Dashboard', path: '/dashboards/doctor', icon: 'dashboard', permission: 'MEDICAL_RECORD_VIEW' },
    { label: 'My Patients', path: '/doctor/patients', icon: 'patients', permission: 'PATIENT_VIEW' },
    { label: 'Appointments', path: '/doctor/appointments', icon: 'calendar', permission: 'APPOINTMENT_CREATE' },
    { label: 'Consultations', path: '/doctor/consultations', icon: 'clinical', permission: 'MEDICAL_RECORD_CREATE' },
    { label: 'Prescriptions', path: '/doctor/prescriptions', icon: 'prescription', permission: 'PRESCRIPTION_CREATE' },
    { label: 'Lab Orders', path: '/doctor/lab-orders', icon: 'lab', permission: 'LAB_REQUEST_CREATE' },
    { label: 'Imaging Orders', path: '/doctor/imaging-orders', icon: 'radiology', permission: 'IMAGING_REQUEST_CREATE' },
    { label: 'Referrals', path: '/doctor/referrals', icon: 'referral', permission: 'LAB_REQUEST_CREATE' },
  ],
  Nurse: [
    { label: 'Dashboard', path: '/dashboards/nurse', icon: 'dashboard', permission: 'MEDICAL_RECORD_VIEW' },
    { label: 'Ward Patients', path: '/nurse/ward-patients', icon: 'patients', permission: 'PATIENT_VIEW' },
    { label: 'Vitals', path: '/nurse/vitals', icon: 'vitals', permission: 'VITALS_RECORD' },
    { label: 'Nursing Notes', path: '/nurse/notes', icon: 'notes', permission: 'NURSING_NOTE_CREATE' },
    { label: 'Medications', path: '/nurse/medications', icon: 'medication', permission: 'PRESCRIPTION_VIEW' },
    { label: 'Admissions', path: '/nurse/admissions', icon: 'admission', permission: 'ADMISSION_CREATE' },
    { label: 'Discharges', path: '/nurse/discharges', icon: 'discharge', permission: 'DISCHARGE_CREATE' },
  ],
  LabTech: [
    { label: 'Dashboard', path: '/dashboards/lab-tech', icon: 'dashboard', permission: 'LAB_REQUEST_VIEW' },
    { label: 'Pending Tests', path: '/lab/pending', icon: 'lab', permission: 'LAB_REQUEST_VIEW' },
    { label: 'My Tests', path: '/lab/my-tests', icon: 'lab', permission: 'LAB_RESULT_CREATE' },
    { label: 'Enter Results', path: '/lab/enter-results', icon: 'results', permission: 'LAB_RESULT_CREATE' },
    { label: 'Verify Results', path: '/lab/verify', icon: 'verify', permission: 'LAB_RESULT_VERIFY' },
    { label: 'Quality Control', path: '/lab/qc', icon: 'qc', permission: 'LAB_RESULT_VERIFY' },
  ],
  Pharmacy: [
    { label: 'Dashboard', path: '/dashboards/pharmacy', icon: 'dashboard', permission: 'PRESCRIPTION_VIEW' },
    { label: 'Pending Prescriptions', path: '/pharmacy/pending', icon: 'prescription', permission: 'PRESCRIPTION_VIEW' },
    { label: 'Dispensing', path: '/pharmacy/dispensing', icon: 'dispense', permission: 'MEDICATION_DISPENSE' },
    { label: 'Inventory', path: '/pharmacy/inventory', icon: 'inventory', permission: 'INVENTORY_MANAGE' },
    { label: 'Procurement', path: '/pharmacy/procurement', icon: 'procurement', permission: 'PROCUREMENT_CREATE' },
    { label: 'Controlled Substances', path: '/pharmacy/controlled', icon: 'controlled', permission: 'MEDICATION_DISPENSE' },
  ],
  Radiology: [
    { label: 'Dashboard', path: '/dashboards/radiology', icon: 'dashboard', permission: 'IMAGING_REQUEST_VIEW' },
    { label: 'Pending Orders', path: '/radiology/pending', icon: 'radiology', permission: 'IMAGING_REQUEST_VIEW' },
    { label: 'My Studies', path: '/radiology/my-studies', icon: 'radiology', permission: 'IMAGING_REPORT_CREATE' },
    { label: 'Create Reports', path: '/radiology/reports', icon: 'report', permission: 'IMAGING_REPORT_CREATE' },
    { label: 'Schedule', path: '/radiology/schedule', icon: 'calendar', permission: 'IMAGING_REQUEST_VIEW' },
  ],
  OperatingRoom: [
    { label: 'Dashboard', path: '/dashboards/operating-room', icon: 'dashboard', permission: 'SCHEDULE_MANAGE' },
    { label: 'Today\'s Schedule', path: '/or/today', icon: 'calendar', permission: 'SCHEDULE_MANAGE' },
    { label: 'Upcoming Surgeries', path: '/or/upcoming', icon: 'schedule', permission: 'SCHEDULE_MANAGE' },
    { label: 'Team Management', path: '/or/team', icon: 'team', permission: 'SCHEDULE_MANAGE' },
    { label: 'Surgical Reports', path: '/or/reports', icon: 'report', permission: 'SCHEDULE_MANAGE' },
  ],
  WardStaff: [
    { label: 'Dashboard', path: '/dashboards/ward-staff', icon: 'dashboard', permission: 'WARD_MANAGE' },
    { label: 'Bed Management', path: '/wards/beds', icon: 'bed', permission: 'WARD_MANAGE' },
    { label: 'Admissions', path: '/wards/admissions', icon: 'admission', permission: 'ADMISSION_CREATE' },
    { label: 'Patient List', path: '/wards/patients', icon: 'patients', permission: 'PATIENT_VIEW' },
  ],
  Billing: [
    { label: 'Dashboard', path: '/dashboards/billing', icon: 'dashboard', permission: 'BILLING_VIEW' },
    { label: 'Create Invoice', path: '/billing/create', icon: 'invoice', permission: 'BILLING_CREATE' },
    { label: 'Manage Invoices', path: '/billing/invoices', icon: 'invoices', permission: 'BILLING_VIEW' },
    { label: 'Payments', path: '/billing/payments', icon: 'payment', permission: 'BILLING_CREATE' },
    { label: 'Insurance', path: '/billing/insurance', icon: 'insurance', permission: 'BILLING_VIEW' },
  ],
  Receptionist: [
    { label: 'Dashboard', path: '/dashboards/receptionist', icon: 'dashboard', permission: 'PATIENT_CREATE' },
    { label: 'Register Patient', path: '/reception/register', icon: 'register', permission: 'PATIENT_CREATE' },
    { label: 'Check-in', path: '/reception/checkin', icon: 'checkin', permission: 'PATIENT_CREATE' },
    { label: 'Queue Management', path: '/reception/queue', icon: 'queue', permission: 'PATIENT_VIEW' },
    { label: 'Appointments', path: '/reception/appointments', icon: 'calendar', permission: 'APPOINTMENT_CREATE' },
    { label: 'Patient Search', path: '/reception/search', icon: 'search', permission: 'PATIENT_VIEW' },
  ],
  HR: [
    { label: 'Dashboard', path: '/dashboards/hr', icon: 'dashboard', permission: 'REPORT_VIEW' },
    { label: 'Staff Management', path: '/hr/staff', icon: 'staff', permission: 'USER_CREATE' },
    { label: 'Schedules', path: '/hr/schedules', icon: 'schedule', permission: 'SCHEDULE_MANAGE' },
    { label: 'Licenses', path: '/hr/licenses', icon: 'license', permission: 'REPORT_VIEW' },
    { label: 'Reports', path: '/hr/reports', icon: 'analytics', permission: 'REPORT_VIEW' },
  ],
  Finance: [
    { label: 'Dashboard', path: '/dashboards/finance', icon: 'dashboard', permission: 'REPORT_VIEW' },
    { label: 'Revenue', path: '/finance/revenue', icon: 'revenue', permission: 'REPORT_VIEW' },
    { label: 'Invoices', path: '/finance/invoices', icon: 'invoices', permission: 'BILLING_VIEW' },
    { label: 'Insurance Claims', path: '/finance/insurance', icon: 'insurance', permission: 'REPORT_EXPORT' },
    { label: 'Reports', path: '/finance/reports', icon: 'analytics', permission: 'REPORT_EXPORT' },
  ],
  Inventory: [
    { label: 'Dashboard', path: '/dashboards/inventory', icon: 'dashboard', permission: 'INVENTORY_VIEW' },
    { label: 'Stock Levels', path: '/inventory/stock', icon: 'stock', permission: 'INVENTORY_VIEW' },
    { label: 'Procurement', path: '/inventory/procurement', icon: 'procurement', permission: 'PROCUREMENT_CREATE' },
    { label: 'Suppliers', path: '/inventory/suppliers', icon: 'supplier', permission: 'INVENTORY_MANAGE' },
    { label: 'Reports', path: '/inventory/reports', icon: 'analytics', permission: 'REPORT_VIEW' },
  ],
  Emergency: [
    { label: 'Dashboard', path: '/dashboards/emergency', icon: 'dashboard', permission: 'MEDICAL_RECORD_VIEW' },
    { label: 'Triage', path: '/emergency/triage', icon: 'triage', permission: 'MEDICAL_RECORD_CREATE' },
    { label: 'Active Patients', path: '/emergency/active', icon: 'patients', permission: 'PATIENT_VIEW' },
    { label: 'Orders', path: '/emergency/orders', icon: 'orders', permission: 'LAB_REQUEST_CREATE' },
    { label: 'Disposition', path: '/emergency/disposition', icon: 'disposition', permission: 'ADMISSION_CREATE' },
  ],
  Patient: [
    { label: 'My Dashboard', path: '/patient/dashboard', icon: 'dashboard', permission: 'PATIENT_VIEW' },
    { label: 'Appointments', path: '/patient/appointments', icon: 'calendar', permission: 'APPOINTMENT_CREATE' },
    { label: 'Medical Records', path: '/patient/records', icon: 'records', permission: 'MEDICAL_RECORD_VIEW' },
    { label: 'Prescriptions', path: '/patient/prescriptions', icon: 'prescription', permission: 'PRESCRIPTION_VIEW' },
    { label: 'Lab Results', path: '/patient/lab-results', icon: 'lab', permission: 'LAB_RESULT_VIEW' },
    { label: 'Imaging Results', path: '/patient/imaging', icon: 'radiology', permission: 'IMAGING_RESULT_VIEW' },
    { label: 'Invoices', path: '/patient/invoices', icon: 'billing', permission: 'BILLING_VIEW' },
    { label: 'Profile', path: '/patient/profile', icon: 'profile', permission: 'PATIENT_VIEW' },
  ],
};

function filterNavigationByPermissions(navigation, userPermissions) {
  return navigation.map(item => {
    if (item.permission && !userPermissions.includes(item.permission)) {
      return null;
    }
    
    const filtered = { ...item };
    if (item.children) {
      filtered.children = filterNavigationByPermissions(item.children, userPermissions).filter(Boolean);
      if (filtered.children.length === 0) return null;
    }
    return filtered;
  }).filter(Boolean);
}

router.get('/navigation', authenticate, (req, res) => {
  try {
    const roleNavigation = ROLE_NAVIGATION[req.user.role] || [];
    const userPermissions = req.user.permissions || [];
    const filteredNavigation = filterNavigationByPermissions(roleNavigation, userPermissions);
    
    res.json({ 
      navigation: filteredNavigation,
      role: req.user.role,
      user: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name,
        role: req.user.role,
        department: req.user.personnel?.department_id,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/permissions', authenticate, (req, res) => {
  try {
    res.json({ 
      permissions: req.user.permissions || [],
      role: req.user.role,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;