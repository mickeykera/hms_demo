import bcrypt from 'bcryptjs';
import { getDb, createWardBed, createDepartment, createRole, createPermission, assignPermissionToRole, createPersonnel, getPersonnelByUserId, assignDoctorToPatient } from '../models/index.js';

const demoUsers = [
  { username: 'superadmin', password: 'SuperAdmin', role: 'SuperAdmin', department: 'Administration' },
  { username: 'admin', password: 'Admin', role: 'Admin', department: 'Administration' },
  { username: 'receptionist', password: 'Receptionist', role: 'Receptionist', department: 'Front Desk' },
  { username: 'doctor', password: 'Doctor', role: 'Doctor', department: 'Oncology' },
  { username: 'nurse', password: 'Nurse', role: 'Nurse', department: 'Ward' },
  { username: 'labtech', password: 'LabTech', role: 'LabTech', department: 'Laboratory' },
  { username: 'pharmacy', password: 'Pharmacy', role: 'Pharmacy', department: 'Pharmacy' },
  { username: 'radiology', password: 'Radiology', role: 'Radiology', department: 'Radiology' },
  { username: 'billing', password: 'Billing', role: 'Billing', department: 'Finance' },
  { username: 'patient', password: 'Patient', role: 'Patient', department: null },
];

const departments = [
  { name: 'Administration', code: 'ADMIN', description: 'Hospital Administration' },
  { name: 'Cardiology', code: 'CARD', description: 'Cardiology Department' },
  { name: 'Internal Medicine', code: 'INTMED', description: 'Internal Medicine' },
  { name: 'Pediatrics', code: 'PEDS', description: 'Pediatrics Department' },
  { name: 'Surgery', code: 'SURG', description: 'Surgery Department' },
  { name: 'Emergency', code: 'ER', description: 'Emergency Department' },
  { name: 'Laboratory', code: 'LAB', description: 'Laboratory Services' },
  { name: 'Radiology', code: 'RAD', description: 'Radiology & Imaging' },
  { name: 'Pharmacy', code: 'PHARM', description: 'Pharmacy Services' },
  { name: 'Nursing', code: 'NURS', description: 'Nursing Department' },
  { name: 'Front Desk', code: 'FD', description: 'Reception & Front Desk' },
  { name: 'Finance', code: 'FIN', description: 'Finance & Billing' },
  { name: 'Human Resources', code: 'HR', description: 'Human Resources' },
  { name: 'Inventory', code: 'INV', description: 'Inventory & Procurement' },
  { name: 'Oncology', code: 'ONC', description: 'Oncology Department' },
  { name: 'Ward', code: 'WRD', description: 'Inpatient Wards' },
  { name: 'Operating Room', code: 'OR', description: 'Operating Room Services' },
];

const roles = [
  { name: 'SuperAdmin', display_name: 'Super Administrator', description: 'Full system access', hierarchy_level: 10 },
  { name: 'Admin', display_name: 'Hospital Administrator', description: 'Hospital administration access', hierarchy_level: 9 },
  { name: 'DepartmentAdmin', display_name: 'Department Administrator', description: 'Department-level administration', hierarchy_level: 7 },
  { name: 'Doctor', display_name: 'Physician', description: 'Medical doctor', hierarchy_level: 6 },
  { name: 'Nurse', display_name: 'Registered Nurse', description: 'Nursing staff', hierarchy_level: 5 },
  { name: 'LabTech', display_name: 'Laboratory Technician', description: 'Laboratory technical staff', hierarchy_level: 4 },
  { name: 'Pharmacy', display_name: 'Pharmacist', description: 'Pharmacy staff', hierarchy_level: 4 },
  { name: 'Radiology', display_name: 'Radiology Technician', description: 'Radiology technical staff', hierarchy_level: 4 },
  { name: 'OperatingRoom', display_name: 'Operating Room Staff', description: 'OR technical staff', hierarchy_level: 4 },
  { name: 'WardStaff', display_name: 'Ward Staff', description: 'Ward support staff', hierarchy_level: 3 },
  { name: 'Billing', display_name: 'Billing Specialist', description: 'Billing and finance staff', hierarchy_level: 4 },
  { name: 'Receptionist', display_name: 'Receptionist', description: 'Front desk receptionist', hierarchy_level: 3 },
  { name: 'HR', display_name: 'HR Personnel', description: 'Human resources staff', hierarchy_level: 4 },
  { name: 'Finance', display_name: 'Finance Personnel', description: 'Finance department staff', hierarchy_level: 4 },
  { name: 'Inventory', display_name: 'Inventory Personnel', description: 'Inventory management staff', hierarchy_level: 3 },
  { name: 'Emergency', display_name: 'Emergency Department Staff', description: 'ED clinical staff', hierarchy_level: 5 },
  { name: 'Patient', display_name: 'Patient', description: 'Patient portal access', hierarchy_level: 1 },
];

const permissions = [
  { name: 'PATIENT_VIEW', display_name: 'View Patients', description: 'View patient records', category: 'Patient' },
  { name: 'PATIENT_CREATE', display_name: 'Create Patients', description: 'Register new patients', category: 'Patient' },
  { name: 'PATIENT_EDIT', display_name: 'Edit Patients', description: 'Modify patient demographics', category: 'Patient' },
  { name: 'PATIENT_DELETE', display_name: 'Delete Patients', description: 'Delete patient records', category: 'Patient' },
  { name: 'MEDICAL_RECORD_VIEW', display_name: 'View Medical Records', description: 'View clinical records', category: 'Clinical' },
  { name: 'MEDICAL_RECORD_CREATE', display_name: 'Create Medical Records', description: 'Create clinical records', category: 'Clinical' },
  { name: 'MEDICAL_RECORD_EDIT', display_name: 'Edit Medical Records', description: 'Modify clinical records', category: 'Clinical' },
  { name: 'DIAGNOSIS_CREATE', display_name: 'Create Diagnoses', description: 'Enter medical diagnoses', category: 'Clinical' },
  { name: 'TREATMENT_PLAN_CREATE', display_name: 'Create Treatment Plans', description: 'Create treatment plans', category: 'Clinical' },
  { name: 'LAB_REQUEST_CREATE', display_name: 'Create Lab Requests', description: 'Order laboratory tests', category: 'Laboratory' },
  { name: 'LAB_REQUEST_VIEW', display_name: 'View Lab Requests', description: 'View laboratory orders', category: 'Laboratory' },
  { name: 'LAB_RESULT_VIEW', display_name: 'View Lab Results', description: 'View laboratory results', category: 'Laboratory' },
  { name: 'LAB_RESULT_CREATE', display_name: 'Create Lab Results', description: 'Enter laboratory results', category: 'Laboratory' },
  { name: 'LAB_RESULT_EDIT', display_name: 'Edit Lab Results', description: 'Modify laboratory results', category: 'Laboratory' },
  { name: 'LAB_RESULT_VERIFY', display_name: 'Verify Lab Results', description: 'Verify and release lab results', category: 'Laboratory' },
  { name: 'IMAGING_REQUEST_CREATE', display_name: 'Create Imaging Requests', description: 'Order imaging studies', category: 'Radiology' },
  { name: 'IMAGING_RESULT_VIEW', display_name: 'View Imaging Results', description: 'View imaging results', category: 'Radiology' },
  { name: 'IMAGING_REPORT_CREATE', display_name: 'Create Imaging Reports', description: 'Write radiology reports', category: 'Radiology' },
  { name: 'PRESCRIPTION_CREATE', display_name: 'Create Prescriptions', description: 'Write prescriptions', category: 'Pharmacy' },
  { name: 'PRESCRIPTION_VIEW', display_name: 'View Prescriptions', description: 'View prescription orders', category: 'Pharmacy' },
  { name: 'MEDICATION_DISPENSE', display_name: 'Dispense Medications', description: 'Dispense medications to patients', category: 'Pharmacy' },
  { name: 'BILLING_VIEW', display_name: 'View Billing', description: 'View invoices and billing', category: 'Billing' },
  { name: 'BILLING_CREATE', display_name: 'Create Billing', description: 'Generate invoices', category: 'Billing' },
  { name: 'BILLING_EDIT', display_name: 'Edit Billing', description: 'Modify billing records', category: 'Billing' },
  { name: 'APPOINTMENT_CREATE', display_name: 'Create Appointments', description: 'Schedule appointments', category: 'Scheduling' },
  { name: 'APPOINTMENT_EDIT', display_name: 'Edit Appointments', description: 'Modify appointments', category: 'Scheduling' },
  { name: 'USER_CREATE', display_name: 'Create Users', description: 'Create user accounts', category: 'Administration' },
  { name: 'USER_EDIT', display_name: 'Edit Users', description: 'Modify user accounts', category: 'Administration' },
  { name: 'USER_DISABLE', display_name: 'Disable Users', description: 'Deactivate user accounts', category: 'Administration' },
  { name: 'ROLE_CREATE', display_name: 'Create Roles', description: 'Create system roles', category: 'Administration' },
  { name: 'ROLE_EDIT', display_name: 'Edit Roles', description: 'Modify system roles', category: 'Administration' },
  { name: 'REPORT_VIEW', display_name: 'View Reports', description: 'Access system reports', category: 'Administration' },
  { name: 'REPORT_EXPORT', display_name: 'Export Reports', description: 'Export report data', category: 'Administration' },
  { name: 'AUDIT_LOG_VIEW', display_name: 'View Audit Logs', description: 'Access audit trail', category: 'Administration' },
  { name: 'DEPARTMENT_MANAGE', display_name: 'Manage Departments', description: 'Create and modify departments', category: 'Administration' },
  { name: 'SCHEDULE_MANAGE', display_name: 'Manage Schedules', description: 'Manage staff schedules', category: 'Administration' },
  { name: 'INVENTORY_VIEW', display_name: 'View Inventory', description: 'View inventory levels', category: 'Inventory' },
  { name: 'INVENTORY_MANAGE', display_name: 'Manage Inventory', description: 'Modify inventory', category: 'Inventory' },
  { name: 'PROCUREMENT_CREATE', display_name: 'Create Procurement', description: 'Create purchase orders', category: 'Inventory' },
  { name: 'WARD_MANAGE', display_name: 'Manage Wards', description: 'Manage ward/bed assignments', category: 'Ward' },
  { name: 'ADMISSION_CREATE', display_name: 'Create Admissions', description: 'Admit patients', category: 'Ward' },
  { name: 'DISCHARGE_CREATE', display_name: 'Create Discharges', description: 'Discharge patients', category: 'Ward' },
  { name: 'VITALS_RECORD', display_name: 'Record Vitals', description: 'Record patient vital signs', category: 'Clinical' },
  { name: 'NURSING_NOTE_CREATE', display_name: 'Create Nursing Notes', description: 'Write nursing documentation', category: 'Clinical' },
];

const rolePermissionMap = {
  SuperAdmin: permissions.map(p => p.name),
  Admin: [
    'PATIENT_VIEW', 'PATIENT_CREATE', 'PATIENT_EDIT',
    'MEDICAL_RECORD_VIEW', 'MEDICAL_RECORD_CREATE', 'MEDICAL_RECORD_EDIT',
    'DIAGNOSIS_CREATE', 'TREATMENT_PLAN_CREATE',
    'LAB_REQUEST_CREATE', 'LAB_REQUEST_VIEW', 'LAB_RESULT_VIEW', 'LAB_RESULT_VERIFY',
    'IMAGING_REQUEST_CREATE', 'IMAGING_RESULT_VIEW', 'IMAGING_REPORT_CREATE',
    'PRESCRIPTION_CREATE', 'PRESCRIPTION_VIEW', 'MEDICATION_DISPENSE',
    'BILLING_VIEW', 'BILLING_CREATE', 'BILLING_EDIT',
    'APPOINTMENT_CREATE', 'APPOINTMENT_EDIT',
    'USER_CREATE', 'USER_EDIT', 'USER_DISABLE',
    'ROLE_CREATE', 'ROLE_EDIT',
    'REPORT_VIEW', 'REPORT_EXPORT', 'AUDIT_LOG_VIEW',
    'DEPARTMENT_MANAGE', 'SCHEDULE_MANAGE',
    'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'PROCUREMENT_CREATE',
    'WARD_MANAGE', 'ADMISSION_CREATE', 'DISCHARGE_CREATE',
    'VITALS_RECORD', 'NURSING_NOTE_CREATE',
  ],
  DepartmentAdmin: [
    'PATIENT_VIEW', 'PATIENT_CREATE', 'PATIENT_EDIT',
    'MEDICAL_RECORD_VIEW', 'MEDICAL_RECORD_CREATE', 'MEDICAL_RECORD_EDIT',
    'LAB_REQUEST_CREATE', 'LAB_REQUEST_VIEW', 'LAB_RESULT_VIEW',
    'IMAGING_REQUEST_CREATE', 'IMAGING_RESULT_VIEW',
    'PRESCRIPTION_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_EDIT',
    'REPORT_VIEW', 'SCHEDULE_MANAGE', 'INVENTORY_VIEW',
    'WARD_MANAGE', 'ADMISSION_CREATE', 'DISCHARGE_CREATE',
    'VITALS_RECORD', 'NURSING_NOTE_CREATE',
  ],
  Doctor: [
    'PATIENT_VIEW', 'MEDICAL_RECORD_VIEW', 'MEDICAL_RECORD_CREATE', 'MEDICAL_RECORD_EDIT',
    'DIAGNOSIS_CREATE', 'TREATMENT_PLAN_CREATE',
    'LAB_REQUEST_CREATE', 'LAB_REQUEST_VIEW', 'LAB_RESULT_VIEW',
    'IMAGING_REQUEST_CREATE', 'IMAGING_RESULT_VIEW',
    'PRESCRIPTION_CREATE', 'PRESCRIPTION_VIEW',
    'APPOINTMENT_CREATE', 'APPOINTMENT_EDIT',
    'VITALS_RECORD', 'NURSING_NOTE_CREATE',
    'ADMISSION_CREATE', 'DISCHARGE_CREATE',
  ],
  Nurse: [
    'PATIENT_VIEW', 'MEDICAL_RECORD_VIEW',
    'LAB_REQUEST_VIEW', 'LAB_RESULT_VIEW',
    'IMAGING_RESULT_VIEW', 'PRESCRIPTION_VIEW',
    'APPOINTMENT_VIEW', 'VITALS_RECORD', 'NURSING_NOTE_CREATE',
    'ADMISSION_CREATE', 'DISCHARGE_CREATE',
  ],
  LabTech: [
    'PATIENT_VIEW', 'LAB_REQUEST_VIEW', 'LAB_RESULT_VIEW', 'LAB_RESULT_CREATE', 'LAB_RESULT_EDIT', 'LAB_RESULT_VERIFY',
  ],
  Pharmacy: [
    'PATIENT_VIEW', 'PRESCRIPTION_VIEW', 'MEDICATION_DISPENSE', 'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'PROCUREMENT_CREATE',
  ],
  Radiology: [
    'PATIENT_VIEW', 'IMAGING_REQUEST_VIEW', 'IMAGING_RESULT_VIEW', 'IMAGING_REPORT_CREATE',
  ],
  OperatingRoom: [
    'PATIENT_VIEW', 'MEDICAL_RECORD_VIEW', 'SCHEDULE_MANAGE',
  ],
  WardStaff: [
    'PATIENT_VIEW', 'MEDICAL_RECORD_VIEW', 'VITALS_RECORD', 'NURSING_NOTE_CREATE', 'WARD_MANAGE',
  ],
  Billing: [
    'PATIENT_VIEW', 'BILLING_VIEW', 'BILLING_CREATE', 'BILLING_EDIT', 'REPORT_VIEW',
  ],
  Receptionist: [
    'PATIENT_VIEW', 'PATIENT_CREATE', 'PATIENT_EDIT',
    'APPOINTMENT_CREATE', 'APPOINTMENT_EDIT',
  ],
  HR: [
    'USER_CREATE', 'USER_EDIT', 'USER_DISABLE', 'SCHEDULE_MANAGE', 'REPORT_VIEW',
  ],
  Finance: [
    'BILLING_VIEW', 'BILLING_CREATE', 'BILLING_EDIT', 'REPORT_VIEW', 'REPORT_EXPORT',
  ],
  Inventory: [
    'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'PROCUREMENT_CREATE', 'REPORT_VIEW',
  ],
  Emergency: [
    'PATIENT_VIEW', 'PATIENT_CREATE', 'MEDICAL_RECORD_VIEW', 'MEDICAL_RECORD_CREATE', 'MEDICAL_RECORD_EDIT',
    'DIAGNOSIS_CREATE', 'TREATMENT_PLAN_CREATE',
    'LAB_REQUEST_CREATE', 'LAB_REQUEST_VIEW', 'LAB_RESULT_VIEW',
    'IMAGING_REQUEST_CREATE', 'IMAGING_RESULT_VIEW',
    'PRESCRIPTION_CREATE', 'PRESCRIPTION_VIEW', 'MEDICATION_DISPENSE',
    'ADMISSION_CREATE', 'VITALS_RECORD', 'NURSING_NOTE_CREATE',
  ],
  Patient: [
    'PATIENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_EDIT',
    'MEDICAL_RECORD_VIEW', 'LAB_RESULT_VIEW', 'IMAGING_RESULT_VIEW',
    'PRESCRIPTION_VIEW', 'BILLING_VIEW',
  ],
};

function ensureUserRoles() {
  const db = getDb();
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (table?.sql?.includes("'Patient'")) return;

  db.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('SuperAdmin','Admin','Receptionist','Doctor','Nurse','LabTech','Pharmacy','Radiology','OperatingRoom','WardStaff','Billing','Patient','HR','Finance','Inventory','Emergency')),
      department TEXT,
      email TEXT,
      phone TEXT,
      patient_id INTEGER,
      personnel_id INTEGER,
      active BOOLEAN DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users_new (id, username, password_hash, full_name, role, department, created_at)
      SELECT id, username, password_hash, full_name, role, department, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    PRAGMA foreign_keys = ON;
  `);
}

export function seedDemoData() {
  const db = getDb();
  ensureUserRoles();

  // Seed departments
  for (const dept of departments) {
    const existing = db.prepare('SELECT id FROM departments WHERE code = ?').get(dept.code);
    if (!existing) {
      createDepartment(dept);
    }
  }

  // Seed roles
  for (const role of roles) {
    const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(role.name);
    if (!existing) {
      createRole(role);
    }
  }

  // Seed permissions
  for (const perm of permissions) {
    const existing = db.prepare('SELECT id FROM permissions WHERE name = ?').get(perm.name);
    if (!existing) {
      createPermission(perm);
    }
  }

  // Assign permissions to roles
  for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (role) {
      for (const permName of permNames) {
        const perm = db.prepare('SELECT id FROM permissions WHERE name = ?').get(permName);
        if (perm) {
          assignPermissionToRole(role.id, perm.id);
        }
      }
    }
  }

  // Seed demo users
  for (const user of demoUsers) {
    const passwordHash = bcrypt.hashSync(user.password, 10);
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);

    if (existing) {
      db.prepare('UPDATE users SET password_hash = ?, full_name = ?, role = ?, department = ? WHERE id = ?')
        .run(passwordHash, `${user.role} User`, user.role, user.department, existing.id);
    } else {
      db.prepare('INSERT INTO users (username, password_hash, full_name, role, department, active) VALUES (?, ?, ?, ?, ?, ?)')
        .run(user.username, passwordHash, `${user.role} User`, user.role, user.department, 1);
    }
  }

  // Create personnel records for staff users
  const staffUsers = demoUsers.filter(u => u.role !== 'Patient');
  for (const user of staffUsers) {
    const dbUser = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
    if (dbUser) {
      const existingPersonnel = getPersonnelByUserId(dbUser.id);
      if (!existingPersonnel) {
        const dept = db.prepare('SELECT id FROM departments WHERE name = ?').get(user.department);
        const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(user.role);
        const personnelResult = createPersonnel({
          employee_id: `EMP-${dbUser.id.toString().padStart(4, '0')}`,
          user_id: dbUser.id,
          first_name: user.role,
          last_name: 'User',
          email: `${user.username}@hospital.local`,
          phone: `555-${1000 + dbUser.id}`,
          hire_date: '2020-01-15',
          employment_status: 'Active',
          professional_title: user.role,
          department_id: dept?.id,
          role_id: role?.id,
        });
        db.prepare('UPDATE users SET personnel_id = ? WHERE id = ?').run(personnelResult.lastInsertRowid, dbUser.id);
      }
    }
  }

  // Ensure demo patient exists for patient login
  const demoPatient = db.prepare("SELECT id FROM patients WHERE global_id = 'DEMO001'").get();
  if (!demoPatient) {
    db.prepare(
      `INSERT INTO patients (global_id, first_name, last_name, date_of_birth, gender, blood_type, email, phone, address, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('DEMO001', 'Demo', 'Patient', '1990-01-15', 'Male', 'O+', 'patient@demo.local', '+1234567890', '123 Demo St', 'John Doe', '+9876543210', 'Demo Insurance', 'INS123456');
  }
  const patient = db.prepare("SELECT id FROM patients WHERE global_id = 'DEMO001'").get();
  db.prepare("UPDATE users SET patient_id = ? WHERE username = 'patient'").run(patient.id);

  // Create patient personnel record
  const patientUser = db.prepare('SELECT id FROM users WHERE username = ?').get('patient');
  if (patientUser) {
    const existingPersonnel = getPersonnelByUserId(patientUser.id);
    if (!existingPersonnel) {
      createPersonnel({
        employee_id: `PAT-${patientUser.id.toString().padStart(4, '0')}`,
        user_id: patientUser.id,
        first_name: 'Demo',
        last_name: 'Patient',
        email: 'patient@demo.local',
        phone: '+1234567890',
        date_of_birth: '1990-01-15',
        gender: 'Male',
        hire_date: '2024-01-01',
        employment_status: 'Active',
      });
    }
  }

  // Assign doctor to demo patient
  const doctorUser = db.prepare('SELECT id FROM users WHERE username = ?').get('doctor');
  if (doctorUser && patient) {
    assignDoctorToPatient({ patient_id: patient.id, doctor_id: doctorUser.id, assignment_type: 'Primary', assigned_by: doctorUser.id });
  }

  // Seed wards and rooms
  const wards = [
    { name: 'ICU', building: 'Main', floor: 2, ward_type: 'ICU', capacity: 10, nursing_station_phone: '555-1001' },
    { name: 'General Ward A', building: 'Main', floor: 3, ward_type: 'General', capacity: 20, nursing_station_phone: '555-1002' },
    { name: 'General Ward B', building: 'Main', floor: 3, ward_type: 'General', capacity: 20, nursing_station_phone: '555-1003' },
    { name: 'Private Ward', building: 'East', floor: 4, ward_type: 'Private', capacity: 10, nursing_station_phone: '555-1004' },
    { name: 'Emergency Ward', building: 'Main', floor: 1, ward_type: 'Emergency', capacity: 15, nursing_station_phone: '555-1005' },
    { name: 'Maternity', building: 'East', floor: 2, ward_type: 'Maternity', capacity: 12, nursing_station_phone: '555-1006' },
    { name: 'Pediatrics', building: 'West', floor: 2, ward_type: 'PICU', capacity: 15, nursing_station_phone: '555-1007' },
  ];

  for (const ward of wards) {
    const existing = db.prepare('SELECT id FROM wards WHERE name = ?').get(ward.name);
    if (!existing) {
      db.prepare('INSERT INTO wards (name, building, floor, ward_type, capacity, nursing_station_phone) VALUES (?, ?, ?, ?, ?, ?)')
        .run(ward.name, ward.building, ward.floor, ward.ward_type, ward.capacity, ward.nursing_station_phone);
    }
  }

  // Seed rooms for each ward
  const wardRooms = {
    'ICU': [{ room_number: 'ICU-01', room_type: 'ICU', capacity: 1 }, { room_number: 'ICU-02', room_type: 'ICU', capacity: 1 }],
    'General Ward A': [{ room_number: 'G101', room_type: 'General', capacity: 2 }, { room_number: 'G102', room_type: 'General', capacity: 2 }, { room_number: 'G103', room_type: 'General', capacity: 2 }],
    'General Ward B': [{ room_number: 'G201', room_type: 'General', capacity: 2 }, { room_number: 'G202', room_type: 'General', capacity: 2 }],
    'Private Ward': [{ room_number: 'P101', room_type: 'Private', capacity: 1 }, { room_number: 'P102', room_type: 'Private', capacity: 1 }, { room_number: 'P103', room_type: 'Private', capacity: 1 }],
    'Emergency Ward': [{ room_number: 'ER-01', room_type: 'Emergency', capacity: 1 }, { room_number: 'ER-02', room_type: 'Emergency', capacity: 1 }, { room_number: 'ER-03', room_type: 'Emergency', capacity: 1 }],
    'Maternity': [{ room_number: 'M101', room_type: 'Private', capacity: 1 }, { room_number: 'M102', room_type: 'Private', capacity: 1 }],
    'Pediatrics': [{ room_number: 'PED-01', room_type: 'General', capacity: 2 }, { room_number: 'PED-02', room_type: 'General', capacity: 2 }],
  };

  for (const [wardName, rooms] of Object.entries(wardRooms)) {
    const ward = db.prepare('SELECT id FROM wards WHERE name = ?').get(wardName);
    if (ward) {
      for (const room of rooms) {
        const existing = db.prepare('SELECT id FROM rooms WHERE ward_id = ? AND room_number = ?').get(ward.id, room.room_number);
        if (!existing) {
          db.prepare('INSERT INTO rooms (ward_id, room_number, room_type, capacity) VALUES (?, ?, ?, ?)')
            .run(ward.id, room.room_number, room.room_type, room.capacity);
        }
      }
    }
  }

  // Seed ward beds
  const beds = [
    ['ICU', 'ICU-01', 'ICU'],
    ['General', 'G-101', 'General'],
    ['General', 'G-102', 'General'],
    ['Private', 'P-201', 'Private'],
  ];
  for (const [wardName, bedNumber, bedType] of beds) {
    const existing = db.prepare('SELECT id FROM ward_beds WHERE bed_number = ?').get(bedNumber);
    if (!existing) createWardBed({ ward_name: wardName, bed_number: bedNumber, bed_type: bedType, status: 'Available' });
  }

  // Seed some demo medications
  const meds = [
    { name: 'Acetaminophen', generic_name: 'Paracetamol', strength: '500mg', form: 'Tablet', manufacturer: 'Generic Pharma', unit_price: 0.10, requires_prescription: 0, controlled_substance: 0 },
    { name: 'Ibuprofen', generic_name: 'Ibuprofen', strength: '200mg', form: 'Tablet', manufacturer: 'Generic Pharma', unit_price: 0.15, requires_prescription: 0, controlled_substance: 0 },
    { name: 'Amoxicillin', generic_name: 'Amoxicillin', strength: '500mg', form: 'Capsule', manufacturer: 'Antibiotic Inc', unit_price: 0.50, requires_prescription: 1, controlled_substance: 0 },
    { name: 'Lisinopril', generic_name: 'Lisinopril', strength: '10mg', form: 'Tablet', manufacturer: 'CardioMed', unit_price: 0.25, requires_prescription: 1, controlled_substance: 0 },
    { name: 'Metformin', generic_name: 'Metformin', strength: '500mg', form: 'Tablet', manufacturer: 'DiabetesCare', unit_price: 0.20, requires_prescription: 1, controlled_substance: 0 },
    { name: 'Atorvastatin', generic_name: 'Atorvastatin', strength: '20mg', form: 'Tablet', manufacturer: 'LipidPharma', unit_price: 0.30, requires_prescription: 1, controlled_substance: 0 },
    { name: 'Omeprazole', generic_name: 'Omeprazole', strength: '20mg', form: 'Capsule', manufacturer: 'GastroMed', unit_price: 0.25, requires_prescription: 1, controlled_substance: 0 },
    { name: 'Morphine', generic_name: 'Morphine Sulfate', strength: '10mg/mL', form: 'Injection', manufacturer: 'PainRelief', unit_price: 5.00, requires_prescription: 1, controlled_substance: 1 },
  ];

  for (const med of meds) {
    const existing = db.prepare('SELECT id FROM medications WHERE name = ? AND strength = ?').get(med.name, med.strength);
    if (!existing) {
      db.prepare('INSERT INTO medications (name, generic_name, strength, form, manufacturer, unit_price, requires_prescription, controlled_substance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(med.name, med.generic_name, med.strength, med.form, med.manufacturer, med.unit_price, med.requires_prescription, med.controlled_substance);
    }
  }
}