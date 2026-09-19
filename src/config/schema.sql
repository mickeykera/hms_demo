CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_department_id INTEGER,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  hierarchy_level INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS personnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE NOT NULL,
  user_id INTEGER UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  date_of_birth DATE,
  gender TEXT CHECK(gender IN ('Male','Female','Other','PreferNotToSay')),
  hire_date DATE NOT NULL,
  employment_status TEXT DEFAULT 'Active' CHECK(employment_status IN ('Active','OnLeave','Terminated','Retired')),
  professional_title TEXT,
  license_number TEXT,
  license_expiry DATE,
  department_id INTEGER,
  role_id INTEGER,
  supervisor_id INTEGER,
  work_schedule TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (supervisor_id) REFERENCES personnel(id)
);

CREATE TABLE IF NOT EXISTS users (
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (personnel_id) REFERENCES personnel(id)
);

CREATE TABLE IF NOT EXISTS patient_doctor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  assignment_type TEXT DEFAULT 'Primary' CHECK(assignment_type IN ('Primary','Consulting','OnCall','Referral')),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER,
  active BOOLEAN DEFAULT 1,
  ended_at DATETIME,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE(patient_id, doctor_id, assignment_type)
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  global_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK(gender IN ('Male','Female','Other','PreferNotToSay')),
  blood_type TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  insurance_provider TEXT,
  insurance_id TEXT,
  insurance_validity DATE,
  medical_history_summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  visit_type TEXT CHECK(visit_type IN ('WalkIn','Scheduled','Emergency','FollowUp')),
  triage_priority INTEGER DEFAULT 3 CHECK(triage_priority BETWEEN 1 AND 5),
  queue_position INTEGER,
  department TEXT,
  status TEXT DEFAULT 'Waiting' CHECK(status IN ('Waiting','InConsultation','Completed','Cancelled')),
  check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  check_out_time DATETIME,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS medical_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  condition TEXT NOT NULL,
  diagnosis_date DATE,
  treatment TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  notes TEXT,
  consultation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visit_id) REFERENCES visits(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultation_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration_days INTEGER,
  instructions TEXT,
  prescribing_doctor_id INTEGER NOT NULL,
  status TEXT DEFAULT 'ORDERED' CHECK(status IN ('ORDERED','REVIEW_PENDING','APPROVED','DISPENSING','DISPENSED','REJECTED')),
  rejection_reason TEXT,
  dispensed BOOLEAN DEFAULT 0,
  dispensed_at DATETIME,
  dispensed_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consultation_id) REFERENCES consultations(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (prescribing_doctor_id) REFERENCES users(id),
  FOREIGN KEY (dispensed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  visit_id INTEGER,
  invoice_number TEXT UNIQUE NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Unpaid' CHECK(status IN ('Unpaid','Partial','Paid','Cancelled')),
  insurance_applicable BOOLEAN DEFAULT 0,
  insurance_status TEXT DEFAULT 'NotChecked',
  pharmacy_items TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id)
);

CREATE TABLE IF NOT EXISTS lab_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  order_doctor_id INTEGER NOT NULL,
  test_name TEXT NOT NULL,
  test_type TEXT,
  status TEXT DEFAULT 'Ordered' CHECK(status IN ('Ordered','CollectionPending','Collected','InProgress','Verified','Released','Completed','Cancelled')),
  sample_id TEXT UNIQUE,
  ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (order_doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_test_id INTEGER NOT NULL,
  result_data TEXT,
  reference_range TEXT,
  flagged BOOLEAN DEFAULT 0,
  lab_tech_id INTEGER,
  entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lab_test_id) REFERENCES lab_tests(id),
  FOREIGN KEY (lab_tech_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS imaging_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  ordering_doctor_id INTEGER NOT NULL,
  modality TEXT NOT NULL,
  body_part TEXT NOT NULL,
  clinical_indication TEXT,
  status TEXT DEFAULT 'ORDERED' CHECK(status IN ('ORDERED','SCHEDULED','IN_PROGRESS','REPORT_PENDING','REPORTED','VERIFIED','RELEASED','CANCELLED')),
  scheduled_at DATETIME,
  ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (ordering_doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS imaging_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imaging_order_id INTEGER NOT NULL,
  findings TEXT NOT NULL,
  impression TEXT,
  reported_by INTEGER NOT NULL,
  verified_by INTEGER,
  reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME,
  FOREIGN KEY (imaging_order_id) REFERENCES imaging_orders(id),
  FOREIGN KEY (reported_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ward_beds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ward_name TEXT NOT NULL,
  bed_number TEXT NOT NULL,
  bed_type TEXT CHECK(bed_type IN ('General','Private','ICU','Isolation')),
  status TEXT DEFAULT 'Available' CHECK(status IN ('Available','Occupied','Reserved','Maintenance')),
  patient_id INTEGER,
  admitted_at DATETIME,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS admissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  bed_id INTEGER NOT NULL,
  admission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  discharge_date DATETIME,
  reason TEXT,
  status TEXT DEFAULT 'Admitted' CHECK(status IN ('Admitted','Discharged','Transferred')),
  admitting_doctor_id INTEGER,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (bed_id) REFERENCES ward_beds(id),
  FOREIGN KEY (admitting_doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS nursing_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_id INTEGER NOT NULL,
  nurse_id INTEGER NOT NULL,
  note_text TEXT NOT NULL,
  vital_signs TEXT,
  note_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admission_id) REFERENCES admissions(id),
  FOREIGN KEY (nurse_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS iot_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  device_type TEXT NOT NULL,
  device_id TEXT NOT NULL,
  telemetry_data TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS or_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  procedure_name TEXT NOT NULL,
  scheduled_date DATETIME NOT NULL,
  surgeon_id INTEGER NOT NULL,
  anesthesiologist_id INTEGER,
  status TEXT DEFAULT 'Scheduled' CHECK(status IN ('Scheduled','InProgress','Completed','Cancelled')),
  prep_complete BOOLEAN DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (surgeon_id) REFERENCES users(id),
  FOREIGN KEY (anesthesiologist_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS or_team (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  FOREIGN KEY (schedule_id) REFERENCES or_schedules(id),
  FOREIGN KEY (member_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS surgical_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  procedure_notes TEXT,
  complications TEXT,
  outcome TEXT,
  surgeon_notes TEXT,
  post_op_care_instructions TEXT,
  report_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES or_schedules(id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  scheduled_date DATETIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  appointment_type TEXT DEFAULT 'Consultation' CHECK(appointment_type IN ('Consultation','FollowUp','Procedure','Checkup')),
  status TEXT DEFAULT 'Scheduled' CHECK(status IN ('Scheduled','Confirmed','InProgress','Completed','Cancelled','NoShow')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT,
  form TEXT CHECK(form IN ('Tablet','Capsule','Syrup','Injection','Cream','Drops','Inhaler','Patch','Other')),
  manufacturer TEXT,
  unit_price REAL,
  requires_prescription BOOLEAN DEFAULT 1,
  controlled_substance BOOLEAN DEFAULT 0,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE NOT NULL,
  location TEXT,
  unit_cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medication_id) REFERENCES medications(id)
);

CREATE TABLE IF NOT EXISTS pharmacy_dispensing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL,
  medication_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  instructions TEXT,
  dispensed_by INTEGER NOT NULL,
  dispensed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  FOREIGN KEY (medication_id) REFERENCES medications(id),
  FOREIGN KEY (dispensed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_entity TEXT,
  related_entity_id INTEGER,
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  FOREIGN KEY (recipient_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id INTEGER,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant1_id INTEGER NOT NULL,
  participant2_id INTEGER NOT NULL,
  patient_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant1_id) REFERENCES users(id),
  FOREIGN KEY (participant2_id) REFERENCES users(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS department_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_number TEXT UNIQUE NOT NULL,
  requesting_user_id INTEGER NOT NULL,
  requesting_department_id INTEGER NOT NULL,
  receiving_department_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  request_type TEXT NOT NULL CHECK(request_type IN ('LabTest','Imaging','Pharmacy','Consultation','Referral','Admission','Transfer','Procedure','Other')),
  priority TEXT DEFAULT 'Routine' CHECK(priority IN ('Routine','Urgent','Stat','Emergency')),
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Accepted','InProgress','Completed','Verified','Cancelled','Rejected')),
  clinical_details TEXT,
  notes TEXT,
  attachments TEXT,
  result_data TEXT,
  result_notes TEXT,
  completed_by INTEGER,
  verified_by INTEGER,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  verified_at DATETIME,
  FOREIGN KEY (requesting_user_id) REFERENCES users(id),
  FOREIGN KEY (requesting_department_id) REFERENCES departments(id),
  FOREIGN KEY (receiving_department_id) REFERENCES departments(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (completed_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS request_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  request_type TEXT NOT NULL CHECK(request_type IN ('LabTest','Imaging','Pharmacy','Consultation','Referral','Admission','Transfer','Procedure','Other')),
  default_priority TEXT DEFAULT 'Routine' CHECK(default_priority IN ('Routine','Urgent','Stat','Emergency')),
  clinical_details_template TEXT,
  notes_template TEXT,
  receiving_department_id INTEGER NOT NULL,
  created_by INTEGER,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receiving_department_id) REFERENCES departments(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sla_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_type TEXT NOT NULL CHECK(request_type IN ('LabTest','Imaging','Pharmacy','Consultation','Referral','Admission','Transfer','Procedure','Other')),
  priority TEXT NOT NULL CHECK(priority IN ('Routine','Urgent','Stat','Emergency')),
  receiving_department_id INTEGER NOT NULL,
  response_time_minutes INTEGER NOT NULL DEFAULT 60,
  resolution_time_minutes INTEGER NOT NULL DEFAULT 1440,
  escalation_time_minutes INTEGER,
  escalation_user_id INTEGER,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receiving_department_id) REFERENCES departments(id),
  FOREIGN KEY (escalation_user_id) REFERENCES users(id),
  UNIQUE(request_type, priority, receiving_department_id)
);

CREATE TABLE IF NOT EXISTS request_escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  escalated_to_user_id INTEGER NOT NULL,
  escalated_by_user_id INTEGER,
  reason TEXT,
  sla_config_id INTEGER,
  acknowledged BOOLEAN DEFAULT 0,
  acknowledged_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES department_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (escalated_to_user_id) REFERENCES users(id),
  FOREIGN KEY (escalated_by_user_id) REFERENCES users(id),
  FOREIGN KEY (sla_config_id) REFERENCES sla_configs(id)
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('request_created', 'status_changed', 'result_submitted', 'sla_breach', 'manual')),
  trigger_config TEXT,
  steps TEXT,
  active BOOLEAN DEFAULT 1,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_definition_id INTEGER NOT NULL,
  trigger_resource_type TEXT,
  trigger_resource_id INTEGER,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Running' CHECK(status IN ('Running','Completed','Failed','Cancelled')),
  context TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL,
  department_id INTEGER,
  document_type TEXT NOT NULL CHECK(document_type IN ('LabReport','ImagingReport','MedicalCertificate','DischargeSummary','ReferralLetter','Prescription','ConsentForm','InsuranceDocument','Other')),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  access_level TEXT DEFAULT 'Department' CHECK(access_level IN ('Private','Department','Hospital','Patient')),
  version INTEGER DEFAULT 1,
  parent_document_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (parent_document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS wards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  building TEXT,
  floor INTEGER,
  ward_type TEXT CHECK(ward_type IN ('General','ICU','NICU','PICU','Emergency','Maternity','Psychiatric','Isolation','Recovery','Private')),
  capacity INTEGER,
  nursing_station_phone TEXT,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ward_id INTEGER NOT NULL,
  room_number TEXT NOT NULL,
  room_type TEXT CHECK(room_type IN ('General','Private','ICU','Isolation','Procedure','Consultation','Emergency')),
  capacity INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ward_id) REFERENCES wards(id),
  UNIQUE(ward_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_patients_global_id ON patients(global_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient ON imaging_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_status ON imaging_orders(status);
CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_iot_patient ON iot_telemetry(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_med ON pharmacy_inventory(medication_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_expiry ON pharmacy_inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_patient ON pharmacy_dispensing(prescription_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant1_id, participant2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_users_personnel ON users(personnel_id);
CREATE INDEX IF NOT EXISTS idx_personnel_department ON personnel(department_id);
CREATE INDEX IF NOT EXISTS idx_personnel_role ON personnel(role_id);
CREATE INDEX IF NOT EXISTS idx_personnel_supervisor ON personnel(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_patient ON patient_doctor(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_doctor ON patient_doctor(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_active ON patient_doctor(active);
CREATE INDEX IF NOT EXISTS idx_dept_requests_patient ON department_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_dept_requests_receiving ON department_requests(receiving_department_id);
CREATE INDEX IF NOT EXISTS idx_dept_requests_status ON department_requests(status);
CREATE INDEX IF NOT EXISTS idx_dept_requests_requesting ON department_requests(requesting_department_id);
CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_access ON documents(access_level);
CREATE INDEX IF NOT EXISTS idx_wards_active ON wards(active);
CREATE INDEX IF NOT EXISTS idx_rooms_ward ON rooms(ward_id);
