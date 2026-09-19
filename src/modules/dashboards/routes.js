import { Router } from 'express';
import { authorize, authorizeModule } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();

function getBaseStats(db) {
  return {
    totalPatients: db.prepare('SELECT COUNT(*) as count FROM patients').get().count,
    activeVisits: db.prepare("SELECT COUNT(*) as count FROM visits WHERE status IN ('Waiting', 'InConsultation')").get().count,
    pendingAppointments: db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'Scheduled' AND scheduled_date > datetime('now')").get().count,
    unpaidInvoices: db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status IN ('Unpaid', 'Partial')").get().count,
  };
}

router.get('/superadmin', authorize(['SuperAdmin']), (req, res) => {
  const stats = getBaseStats(db.getDb());
  const recentUsers = db.getDb().prepare('SELECT id, username, full_name, role, active, last_login, created_at FROM users ORDER BY created_at DESC LIMIT 10').all();
  const recentAuditLogs = db.getDb().prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20').all();
  const systemHealth = {
    db: 'connected',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  res.json({ stats, recentUsers, recentAuditLogs, systemHealth });
});

router.get('/admin', authorize(['Admin', 'SuperAdmin']), (req, res) => {
  const stats = getBaseStats(db.getDb());
  const departmentStats = db.getDb().prepare(`
    SELECT d.name, d.code, COUNT(u.id) as staff_count
    FROM departments d
    LEFT JOIN users u ON u.department = d.name AND u.active = 1
    GROUP BY d.id
  `).all();
  const bedOccupancy = db.getDb().prepare(`
    SELECT w.name, w.capacity, COUNT(wb.id) as occupied
    FROM wards w
    LEFT JOIN ward_beds wb ON wb.ward_name = w.name AND wb.status = 'Occupied'
    WHERE w.active = 1
    GROUP BY w.id
  `).all();
  const recentAlerts = db.getDb().prepare("SELECT * FROM audit_logs WHERE action IN ('CREATE', 'DELETE', 'UPDATE') ORDER BY created_at DESC LIMIT 10").all();
  res.json({ stats, departmentStats, bedOccupancy, recentAlerts });
});

router.get('/department-admin', authorize(['DepartmentAdmin', 'Admin', 'SuperAdmin']), (req, res) => {
  const deptId = req.user.personnel?.department_id;
  if (!deptId) return res.status(403).json({ error: 'No department assigned' });
  
  const dept = db.getDepartmentById(deptId);
  const stats = {
    totalPatients: db.getDb().prepare('SELECT COUNT(*) as count FROM patients').get().count,
    departmentStaff: db.getDb().prepare('SELECT COUNT(*) as count FROM personnel WHERE department_id = ? AND employment_status = ?').get(deptId, 'Active').count,
    pendingRequests: db.getDb().prepare('SELECT COUNT(*) as count FROM department_requests WHERE receiving_department_id = ? AND status IN (?, ?)').get(deptId, 'Pending', 'Accepted').count,
    activeAdmissions: db.getDb().prepare(`
      SELECT COUNT(*) as count FROM admissions a
      JOIN ward_beds wb ON a.bed_id = wb.id
      JOIN wards w ON wb.ward_name = w.name
      WHERE w.id = ? AND a.status = 'Admitted'
    `).get(deptId).count,
  };
  const staff = db.getAllPersonnel({ department_id: deptId });
  const pendingRequests = db.getDepartmentRequests({ receiving_department_id: deptId, status: 'Pending', limit: 10 });
  res.json({ department: dept, stats, staff, pendingRequests });
});

router.get('/doctor', authorize(['Doctor', 'Emergency', 'Admin', 'SuperAdmin']), (req, res) => {
  const doctorId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  
  const myAppointments = db.getDb().prepare(`
    SELECT a.*, p.first_name, p.last_name, p.global_id
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    WHERE a.doctor_id = ? AND date(a.scheduled_date) = ? AND a.status NOT IN ('Cancelled', 'NoShow', 'Completed')
    ORDER BY a.scheduled_date
  `).all(doctorId, today);
  
  const myPatients = db.getDoctorPatients(doctorId);
  const pendingLabResults = db.getDb().prepare(`
    SELECT lt.*, p.first_name, p.last_name, p.global_id
    FROM lab_tests lt
    JOIN patients p ON lt.patient_id = p.id
    WHERE lt.order_doctor_id = ? AND lt.status IN ('Ordered', 'CollectionPending', 'Collected', 'InProgress')
    ORDER BY lt.ordered_at DESC
    LIMIT 10
  `).all(doctorId);
  
  const pendingImaging = db.getDb().prepare(`
    SELECT io.*, p.first_name, p.last_name, p.global_id
    FROM imaging_orders io
    JOIN patients p ON io.patient_id = p.id
    WHERE io.ordering_doctor_id = ? AND io.status IN ('ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'REPORT_PENDING')
    ORDER BY io.ordered_at DESC
    LIMIT 10
  `).all(doctorId);
  
  const activePrescriptions = db.getDb().prepare(`
    SELECT pr.*, p.first_name, p.last_name, p.global_id
    FROM prescriptions pr
    JOIN patients p ON pr.patient_id = p.id
    WHERE pr.prescribing_doctor_id = ? AND pr.status IN ('ORDERED', 'REVIEW_PENDING', 'APPROVED', 'DISPENSING')
    ORDER BY pr.created_at DESC
    LIMIT 10
  `).all(doctorId);
  
  res.json({
    appointments: myAppointments,
    patients: myPatients.slice(0, 20),
    pendingLabResults,
    pendingImaging,
    activePrescriptions,
  });
});

router.get('/nurse', authorize(['Nurse', 'Admin', 'SuperAdmin']), (req, res) => {
  const nurseId = req.user.id;
  const personnel = req.user.personnel;
  const wardId = personnel?.department_id;
  
  let wardPatients = [];
  if (wardId) {
    wardPatients = db.getDb().prepare(`
      SELECT a.*, p.first_name, p.last_name, p.global_id, p.date_of_birth, p.gender, wb.bed_number, w.name as ward_name
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN ward_beds wb ON a.bed_id = wb.id
      JOIN wards w ON wb.ward_name = w.name
      WHERE w.id = ? AND a.status = 'Admitted'
      ORDER BY wb.bed_number
    `).all(wardId);
  }
  
  const pendingVitals = db.getDb().prepare(`
    SELECT a.id as admission_id, p.first_name, p.last_name, p.global_id, wb.bed_number
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    JOIN ward_beds wb ON a.bed_id = wb.id
    JOIN wards w ON wb.ward_name = w.name
    WHERE a.status = 'Admitted' AND w.id = ?
    ORDER BY a.admission_date
  `).all(wardId || 0);
  
  const myTasks = db.getDb().prepare(`
    SELECT 'vitals' as type, a.id as ref_id, p.first_name, p.last_name, wb.bed_number
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    JOIN ward_beds wb ON a.bed_id = wb.id
    JOIN wards w ON wb.ward_name = w.name
    WHERE a.status = 'Admitted' AND w.id = ?
    UNION ALL
    SELECT 'medication' as type, pr.id as ref_id, p.first_name, p.last_name, '' as bed_number
    FROM prescriptions pr
    JOIN patients p ON pr.patient_id = p.id
    WHERE pr.status = 'DISPENSING' AND pr.dispensed = 0
    LIMIT 20
  `).all(wardId || 0);
  
  res.json({ wardPatients, pendingVitals, myTasks, wardId });
});

router.get('/lab-tech', authorize(['LabTech', 'Admin', 'SuperAdmin']), (req, res) => {
  const labId = req.user.personnel?.department_id;
  
  const pendingTests = db.getDb().prepare(`
    SELECT lt.*, p.first_name, p.last_name, p.global_id, u.full_name as doctor_name
    FROM lab_tests lt
    JOIN patients p ON lt.patient_id = p.id
    LEFT JOIN users u ON lt.order_doctor_id = u.id
    WHERE lt.status IN ('Ordered', 'CollectionPending', 'Collected', 'InProgress')
    ORDER BY 
      CASE lt.status WHEN 'Stat' THEN 1 WHEN 'Emergency' THEN 2 WHEN 'Urgent' THEN 3 ELSE 4 END,
      lt.ordered_at
    LIMIT 50
  `).all();
  
  const myAssignedTests = db.getDb().prepare(`
    SELECT lt.*, p.first_name, p.last_name, p.global_id
    FROM lab_tests lt
    JOIN patients p ON lt.patient_id = p.id
    WHERE lt.status IN ('Collected', 'InProgress') AND lt.assigned_tech_id = ?
    ORDER BY lt.ordered_at
  `).all(req.user.id);
  
  const completedToday = db.getDb().prepare(`
    SELECT lt.*, p.first_name, p.last_name, p.global_id, lr.entered_at
    FROM lab_tests lt
    JOIN patients p ON lt.patient_id = p.id
    JOIN lab_results lr ON lr.lab_test_id = lt.id
    WHERE lt.status IN ('Verified', 'Released', 'Completed') 
    AND date(lt.completed_at) = date('now')
    ORDER BY lt.completed_at DESC
  `).all();
  
  res.json({ pendingTests, myAssignedTests, completedToday });
});

router.get('/pharmacy', authorize(['Pharmacy', 'Admin', 'SuperAdmin']), (req, res) => {
  const pendingPrescriptions = db.getDb().prepare(`
    SELECT pr.*, p.first_name, p.last_name, p.global_id, u.full_name as doctor_name
    FROM prescriptions pr
    JOIN patients p ON pr.patient_id = p.id
    LEFT JOIN users u ON pr.prescribing_doctor_id = u.id
    WHERE pr.status IN ('ORDERED', 'REVIEW_PENDING', 'APPROVED', 'DISPENSING')
    ORDER BY pr.created_at
    LIMIT 50
  `).all();
  
  const lowStock = db.getDb().prepare(`
    SELECT m.name, m.generic_name, m.strength, m.form, pi.batch_number, pi.quantity, pi.expiry_date, pi.location
    FROM pharmacy_inventory pi
    JOIN medications m ON pi.medication_id = m.id
    WHERE pi.quantity < 10 AND pi.expiry_date > date('now')
    ORDER BY pi.quantity ASC
    LIMIT 20
  `).all();
  
  const expiringSoon = db.getDb().prepare(`
    SELECT m.name, m.generic_name, m.strength, m.form, pi.batch_number, pi.quantity, pi.expiry_date, pi.location
    FROM pharmacy_inventory pi
    JOIN medications m ON pi.medication_id = m.id
    WHERE pi.expiry_date <= date('now', '+30 days') AND pi.quantity > 0
    ORDER BY pi.expiry_date ASC
    LIMIT 20
  `).all();
  
  res.json({ pendingPrescriptions, lowStock, expiringSoon });
});

router.get('/radiology', authorize(['Radiology', 'Admin', 'SuperAdmin']), (req, res) => {
  const pendingOrders = db.getDb().prepare(`
    SELECT io.*, p.first_name, p.last_name, p.global_id, u.full_name as doctor_name
    FROM imaging_orders io
    JOIN patients p ON io.patient_id = p.id
    LEFT JOIN users u ON io.ordering_doctor_id = u.id
    WHERE io.status IN ('ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'REPORT_PENDING')
    ORDER BY 
      CASE io.priority WHEN 'Stat' THEN 1 WHEN 'Emergency' THEN 2 WHEN 'Urgent' THEN 3 ELSE 4 END,
      io.ordered_at
    LIMIT 50
  `).all();
  
  const myReports = db.getDb().prepare(`
    SELECT ir.*, io.modality, io.body_part, p.first_name, p.last_name, p.global_id
    FROM imaging_reports ir
    JOIN imaging_orders io ON ir.imaging_order_id = io.id
    JOIN patients p ON io.patient_id = p.id
    WHERE ir.reported_by = ? AND ir.verified_by IS NULL
    ORDER BY ir.reported_at DESC
    LIMIT 20
  `).all(req.user.id);
  
  res.json({ pendingOrders, myReports });
});

router.get('/billing', authorize(['Billing', 'Finance', 'Admin', 'SuperAdmin']), (req, res) => {
  const unpaidInvoices = db.getDb().prepare(`
    SELECT i.*, p.first_name, p.last_name, p.global_id
    FROM invoices i
    JOIN patients p ON i.patient_id = p.id
    WHERE i.status IN ('Unpaid', 'Partial')
    ORDER BY i.created_at DESC
    LIMIT 50
  `).all();
  
  const recentPayments = db.getDb().prepare(`
    SELECT i.*, p.first_name, p.last_name, p.global_id
    FROM invoices i
    JOIN patients p ON i.patient_id = p.id
    WHERE i.status = 'Paid' AND date(i.updated_at) = date('now')
    ORDER BY i.updated_at DESC
    LIMIT 20
  `).all();
  
  const revenueStats = db.getDb().prepare(`
    SELECT 
      SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END) as collected,
      SUM(CASE WHEN status IN ('Unpaid', 'Partial') THEN balance ELSE 0 END) as outstanding,
      COUNT(CASE WHEN status = 'Paid' THEN 1 END) as paid_count,
      COUNT(CASE WHEN status IN ('Unpaid', 'Partial') THEN 1 END) as unpaid_count
    FROM invoices
    WHERE date(created_at) = date('now')
  `).get();
  
  res.json({ unpaidInvoices, recentPayments, revenueStats });
});

router.get('/receptionist', authorize(['Receptionist', 'Admin', 'SuperAdmin']), (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const todaysAppointments = db.getDb().prepare(`
    SELECT a.*, p.first_name, p.last_name, p.global_id, u.full_name as doctor_name
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.doctor_id = u.id
    WHERE date(a.scheduled_date) = ? AND a.status NOT IN ('Cancelled', 'NoShow')
    ORDER BY a.scheduled_date
  `).all(today);
  
  const waitingPatients = db.getDb().prepare(`
    SELECT v.*, p.first_name, p.last_name, p.global_id, p.phone
    FROM visits v
    JOIN patients p ON v.patient_id = p.id
    WHERE v.status = 'Waiting'
    ORDER BY v.triage_priority ASC, v.queue_position ASC
  `).all();
  
  const recentRegistrations = db.getDb().prepare(`
    SELECT * FROM patients ORDER BY created_at DESC LIMIT 10
  `).all();
  
  const bedAvailability = db.getDb().prepare(`
    SELECT w.name, w.capacity, 
      SUM(CASE WHEN wb.status = 'Available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN wb.status = 'Occupied' THEN 1 ELSE 0 END) as occupied
    FROM wards w
    LEFT JOIN ward_beds wb ON wb.ward_name = w.name
    WHERE w.active = 1
    GROUP BY w.id
  `).all();
  
  res.json({ todaysAppointments, waitingPatients, recentRegistrations, bedAvailability });
});

router.get('/patient', authorize(['Patient']), (req, res) => {
  const patientId = db.getDb().prepare('SELECT patient_id FROM users WHERE id = ?').get(req.user.id)?.patient_id;
  if (!patientId) return res.status(404).json({ error: 'Patient record not linked' });
  
  const patient = db.getPatientById(patientId);
  const upcomingAppointments = db.getDb().prepare(`
    SELECT a.*, u.full_name as doctor_name
    FROM appointments a
    JOIN users u ON a.doctor_id = u.id
    WHERE a.patient_id = ? AND a.scheduled_date > datetime('now') AND a.status NOT IN ('Cancelled', 'NoShow', 'Completed')
    ORDER BY a.scheduled_date
    LIMIT 5
  `).all(patientId);
  
  const recentPrescriptions = db.getPrescriptionsByPatient(patientId).slice(0, 5);
  const recentLabResults = db.getDb().prepare(`
    SELECT lr.*, lt.test_name, lt.status, u.full_name as doctor_name
    FROM lab_results lr
    JOIN lab_tests lt ON lr.lab_test_id = lt.id
    LEFT JOIN users u ON lt.order_doctor_id = u.id
    WHERE lt.patient_id = ?
    ORDER BY lr.entered_at DESC
    LIMIT 5
  `).all(patientId);
  
  const unpaidInvoices = db.getDb().prepare(`
    SELECT * FROM invoices WHERE patient_id = ? AND status IN ('Unpaid', 'Partial') ORDER BY created_at DESC
  `).all(patientId);
  
  res.json({ patient, upcomingAppointments, recentPrescriptions, recentLabResults, unpaidInvoices });
});

router.get('/hr', authorize(['HR', 'Admin', 'SuperAdmin']), (req, res) => {
  const staffStats = db.getDb().prepare(`
    SELECT employment_status, COUNT(*) as count
    FROM personnel
    GROUP BY employment_status
  `).all();
  
  const departmentStaff = db.getDb().prepare(`
    SELECT d.name, COUNT(p.id) as count
    FROM departments d
    LEFT JOIN personnel p ON p.department_id = d.id AND p.employment_status = 'Active'
    GROUP BY d.id
  `).all();
  
  const recentHires = db.getDb().prepare(`
    SELECT * FROM personnel WHERE employment_status = 'Active' ORDER BY hire_date DESC LIMIT 10
  `).all();
  
  const upcomingExpirations = db.getDb().prepare(`
    SELECT * FROM personnel 
    WHERE license_expiry IS NOT NULL AND license_expiry <= date('now', '+60 days') AND employment_status = 'Active'
    ORDER BY license_expiry
  `).all();
  
  res.json({ staffStats, departmentStaff, recentHires, upcomingExpirations });
});

router.get('/finance', authorize(['Finance', 'Admin', 'SuperAdmin']), (req, res) => {
  const revenueSummary = db.getDb().prepare(`
    SELECT 
      SUM(total_amount) as total_billed,
      SUM(paid_amount) as total_collected,
      SUM(balance) as total_outstanding,
      COUNT(*) as total_invoices
    FROM invoices
    WHERE date(created_at) >= date('now', '-30 days')
  `).get();
  
  const departmentRevenue = db.getDb().prepare(`
    SELECT d.name, SUM(i.total_amount) as revenue
    FROM invoices i
    JOIN visits v ON i.visit_id = v.id
    JOIN departments d ON v.department = d.name
    WHERE date(i.created_at) >= date('now', '-30 days')
    GROUP BY d.id
  `).all();
  
  const insuranceClaims = db.getDb().prepare(`
    SELECT i.*, p.first_name, p.last_name, p.global_id
    FROM invoices i
    JOIN patients p ON i.patient_id = p.id
    WHERE i.insurance_applicable = 1 AND i.insurance_status != 'Paid'
    ORDER BY i.created_at DESC
    LIMIT 20
  `).all();
  
  res.json({ revenueSummary, departmentRevenue, insuranceClaims });
});

router.get('/inventory', authorize(['Inventory', 'Pharmacy', 'Admin', 'SuperAdmin']), (req, res) => {
  const inventory = db.getDb().prepare(`
    SELECT m.name, m.generic_name, m.strength, m.form, 
      SUM(pi.quantity) as total_quantity,
      MIN(pi.expiry_date) as earliest_expiry,
      AVG(pi.unit_cost) as avg_cost
    FROM pharmacy_inventory pi
    JOIN medications m ON pi.medication_id = m.id
    GROUP BY m.id
    ORDER BY m.name
  `).all();
  
  const lowStock = inventory.filter(item => item.total_quantity < 10);
  const expiringSoon = inventory.filter(item => item.earliest_expiry && new Date(item.earliest_expiry) <= new Date(Date.now() + 30*24*60*60*1000));
  
  const recentProcurement = db.getDb().prepare(`
    SELECT * FROM pharmacy_inventory ORDER BY created_at DESC LIMIT 10
  `).all();
  
  res.json({ inventory, lowStock, expiringSoon, recentProcurement });
});

router.get('/ward-staff', authorize(['WardStaff', 'Nurse', 'Admin', 'SuperAdmin']), (req, res) => {
  const personnel = req.user.personnel;
  const wardId = personnel?.department_id;
  
  let beds = [];
  if (wardId) {
    beds = db.getDb().prepare(`
      SELECT wb.*, p.first_name, p.last_name, p.global_id, a.admission_date
      FROM ward_beds wb
      JOIN wards w ON wb.ward_name = w.name
      LEFT JOIN patients p ON wb.patient_id = p.id
      LEFT JOIN admissions a ON a.bed_id = wb.id AND a.status = 'Admitted'
      WHERE w.id = ?
      ORDER BY wb.bed_number
    `).all(wardId);
  }
  
  const pendingAdmissions = db.getDb().prepare(`
    SELECT a.*, p.first_name, p.last_name, p.global_id
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    WHERE a.status = 'Admitted' AND a.bed_id IS NULL
    ORDER BY a.admission_date
    LIMIT 10
  `).all();
  
  res.json({ beds, pendingAdmissions, wardId });
});

router.get('/operating-room', authorize(['OperatingRoom', 'Doctor', 'Admin', 'SuperAdmin']), (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const todaysSurgeries = db.getDb().prepare(`
    SELECT os.*, p.first_name, p.last_name, p.global_id, 
      u1.full_name as surgeon_name, u2.full_name as anesthesiologist_name
    FROM or_schedules os
    JOIN patients p ON os.patient_id = p.id
    JOIN users u1 ON os.surgeon_id = u1.id
    LEFT JOIN users u2 ON os.anesthesiologist_id = u2.id
    WHERE date(os.scheduled_date) = ? AND os.status IN ('Scheduled', 'InProgress')
    ORDER BY os.scheduled_date
  `).all(today);
  
  const upcomingSurgeries = db.getDb().prepare(`
    SELECT os.*, p.first_name, p.last_name, p.global_id, u1.full_name as surgeon_name
    FROM or_schedules os
    JOIN patients p ON os.patient_id = p.id
    JOIN users u1 ON os.surgeon_id = u1.id
    WHERE date(os.scheduled_date) > ? AND os.status = 'Scheduled'
    ORDER BY os.scheduled_date
    LIMIT 10
  `).all(today);
  
  const orUtilization = db.getDb().prepare(`
    SELECT COUNT(*) as scheduled, 
      SUM(CASE WHEN status = 'InProgress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed
    FROM or_schedules
    WHERE date(scheduled_date) = ?
  `).get(today);
  
  res.json({ todaysSurgeries, upcomingSurgeries, orUtilization });
});

export default router;