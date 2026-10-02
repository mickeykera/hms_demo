-- Migration: Operational modules that previously had no backend
-- Created: 2026-10-01
--
-- Each table here backs a dashboard tab that rendered "coming soon" because
-- there was nothing to read from or write to.

-- ---------- Procurement ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  lead_time_days INTEGER DEFAULT 7,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','ORDERED','RECEIVED','CANCELLED')),
  total_amount REAL DEFAULT 0,
  expected_date DATE,
  ordered_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (ordered_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL,
  medication_id INTEGER,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost REAL DEFAULT 0,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  FOREIGN KEY (medication_id) REFERENCES medications(id)
);

-- ---------- HR ----------
CREATE TABLE IF NOT EXISTS employee_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_id INTEGER NOT NULL,
  work_date DATE NOT NULL,
  clock_in DATETIME,
  clock_out DATETIME,
  status TEXT DEFAULT 'Present' CHECK(status IN ('Present','Absent','Late','Leave','HalfDay')),
  notes TEXT,
  UNIQUE(personnel_id, work_date),
  FOREIGN KEY (personnel_id) REFERENCES personnel(id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL CHECK(leave_type IN ('Annual','Sick','Parental','Unpaid','Other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Cancelled')),
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (personnel_id) REFERENCES personnel(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_id INTEGER NOT NULL,
  pay_period TEXT NOT NULL,
  basic_salary REAL NOT NULL,
  allowances REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  net_pay REAL NOT NULL,
  status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft','Approved','Paid')),
  processed_by INTEGER,
  processed_at DATETIME,
  UNIQUE(personnel_id, pay_period),
  FOREIGN KEY (personnel_id) REFERENCES personnel(id),
  FOREIGN KEY (processed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_id INTEGER NOT NULL,
  review_period TEXT NOT NULL,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  strengths TEXT,
  improvements TEXT,
  goals TEXT,
  reviewer_id INTEGER,
  status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft','Shared','Acknowledged')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(personnel_id, review_period),
  FOREIGN KEY (personnel_id) REFERENCES personnel(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

-- ---------- Emergency / ambulance dispatch ----------
CREATE TABLE IF NOT EXISTS ambulances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT DEFAULT 'Basic Life Support',
  crew_size INTEGER DEFAULT 2,
  status TEXT DEFAULT 'Available' CHECK(status IN ('Available','Dispatched','EnRoute','Returning','OutOfService')),
  current_location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ambulance_id INTEGER,
  incident_location TEXT NOT NULL,
  incident_type TEXT,
  priority TEXT DEFAULT 'Routine' CHECK(priority IN ('Routine','Urgent','Emergency','Critical')),
  patient_name TEXT,
  destination TEXT,
  dispatched_by INTEGER,
  dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  eta_minutes INTEGER,
  status TEXT DEFAULT 'Dispatched' CHECK(status IN ('Dispatched','EnRoute','AtScene','Returning','Completed','Cancelled')),
  completed_at DATETIME,
  notes TEXT,
  FOREIGN KEY (ambulance_id) REFERENCES ambulances(id),
  FOREIGN KEY (dispatched_by) REFERENCES users(id)
);

-- ---------- System settings ----------
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  category TEXT DEFAULT 'General',
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_personnel ON leave_requests(personnel_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON employee_attendance(work_date);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_records(pay_period);