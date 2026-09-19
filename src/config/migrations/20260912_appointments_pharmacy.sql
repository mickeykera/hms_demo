-- Migration: Add appointments and pharmacy tables
-- Created: 2026-09-12

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

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_med ON pharmacy_inventory(medication_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_expiry ON pharmacy_inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_patient ON pharmacy_dispensing(prescription_id);