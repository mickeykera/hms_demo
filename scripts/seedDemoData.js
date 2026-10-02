/**
 * Demo data seeder for local development and demos.
 *
 * Idempotent: each block runs only when its table is empty, so re-running
 * tops up whatever is missing instead of duplicating rows.
 *
 * Usage: node scripts/seedDemoData.js
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '..', 'hospital.db');
if (!existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}. Start the server once first.`);
  process.exit(1);
}
const db = new DatabaseSync(DB_PATH);

const FIRST = ['Amara','Liam','Sofia','Noah','Priya','Ethan','Zara','Mateo','Yuki','Omar',
  'Chloe','Rohan','Elena','Kai','Nadia','Jonas','Leila','Diego','Aisha','Tomas',
  'Hana','Marcus','Ines','Rafael','Mei','Andre','Sana','Victor','Nina','Oscar'];
const LAST = ['Okafor','Bennett','Rossi','Nakamura','Silva','Kaur','Dubois','Andersen','Costa',
  'Haddad','Novak','Fernandez','Oyelaran','Petrov','Larsen','Moreau','Ibrahim','Vasquez',
  'Lindqvist','Mensah','Bianchi','Sokolov','Ferreira','Kaminski','Rahman'];
const BLOOD = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDER = ['Male','Female','Other'];

let counter = 1000;
function pick(list, salt) {
  counter = (counter * 1103515245 + 12345 + salt) & 0x7fffffff;
  return list[counter % list.length];
}
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
const report = {};
function whenEmpty(table, fn) {
  if (count(table) > 0) { report[table] = `skipped (${count(table)} existing)`; return; }
  report[table] = `${fn()} rows added`;
}

whenEmpty('patients', () => {
  const s = db.prepare(`INSERT INTO patients (global_id, first_name, last_name, date_of_birth,
    gender, blood_type, email, phone, address, emergency_contact_name, emergency_contact_phone,
    insurance_provider, insurance_id, medical_history_summary)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const prov = ['HealthPlus','MediCare Plus','BlueShield','Sanitas'];
  const hist = ['Hypertension','Type 2 Diabetes','Asthma','No known chronic conditions',
    'Hypothyroidism','Osteoarthritis','Mild anaemia'];
  for (let i = 0; i < 30; i++) {
    const f = FIRST[i % FIRST.length], l = LAST[(i * 7) % LAST.length];
    const y = 1945 + ((i * 13) % 60);
    s.run(`HMS-${10000 + i}`, f, l, `${y}-${String((i%12)+1).padStart(2,'0')}-${String((i%27)+1).padStart(2,'0')}`,
      GENDER[i % GENDER.length], BLOOD[i % BLOOD.length],
      `${f.toLowerCase()}.${l.toLowerCase()}@example.com`,
      `555-01${String(10+i).padStart(2,'0')}`, `${100+i} Maple Street, Springfield`,
      `${pick(FIRST,i)} ${l}`, `555-02${String(10+i).padStart(2,'0')}`,
      prov[i % prov.length], `INS-${5000+i}`, hist[i % hist.length]);
  }
  return 30;
});

// Resolve dependent ids AFTER patients exist.
const patientIds = db.prepare('SELECT id FROM patients ORDER BY id').all().map(r => r.id);
const doctorIds = db.prepare("SELECT id FROM users WHERE role IN ('Doctor','Admin') ORDER BY id").all().map(r => r.id);
const nurseIds = db.prepare("SELECT id FROM users WHERE role = 'Nurse'").all().map(r => r.id);
const labIds = db.prepare("SELECT id FROM users WHERE role = 'LabTech'").all().map(r => r.id);
const staffIds = db.prepare('SELECT id FROM users ORDER BY id').all().map(r => r.id);
// Needed by the operational blocks below: HR rows hang off personnel, and
// orders/dispatches/payroll record who raised or reviewed them.
const personnelIds = db.prepare('SELECT id FROM personnel ORDER BY id').all().map(r => r.id);
const adminIds = db.prepare("SELECT id FROM users WHERE role IN ('SuperAdmin','Admin') ORDER BY id").all().map(r => r.id);
if (!doctorIds.length) { console.error('No doctors found; cannot continue.'); process.exit(1); }

// The demo Patient account must be linked to a patient record, otherwise every
// /api/patient/* route 404s with "Patient record not found".
const demoPatientUser = db.prepare("SELECT id FROM users WHERE role = 'Patient' ORDER BY id LIMIT 1").get();
if (demoPatientUser && !db.prepare('SELECT patient_id FROM users WHERE id = ?').get(demoPatientUser.id).patient_id) {
  const link = db.prepare('SELECT id FROM patients ORDER BY id LIMIT 1').get();
  if (link) {
    db.prepare('UPDATE users SET patient_id = ? WHERE id = ?').run(link.id, demoPatientUser.id);
    console.log(`Linked demo patient account to patient record #${link.id}`);
  }
}

whenEmpty('visits', () => {
  const s = db.prepare(`INSERT INTO visits (patient_id, visit_type, triage_priority,
    queue_position, department, status, check_in_time) VALUES (?,?,?,?,?,?,?)`);
  const t = ['WalkIn','Scheduled','Emergency','FollowUp'];
  const d = ['General','Emergency','Cardiology','Pediatrics','Surgery'];
  const st = ['Waiting','InConsultation','Completed'];
  const pr = [1,2,3,3,2,3,3,4];
  for (let i = 0; i < 8; i++) {
    s.run(patientIds[i % patientIds.length], t[i % t.length], pr[i], i+1,
      d[i % d.length], st[i % st.length],
      new Date(Date.now() - (15 + i*9)*60000).toISOString());
  }
  return 8;
});

whenEmpty('appointments', () => {
  const s = db.prepare(`INSERT INTO appointments (patient_id, doctor_id, scheduled_date,
    duration_minutes, appointment_type, status, notes) VALUES (?,?,?,?,?,?,?)`);
  const t = ['Consultation','FollowUp','Procedure','Checkup'];
  const st = ['Scheduled','Confirmed','InProgress','Completed','NoShow'];
  for (let i = 0; i < 14; i++) {
    const w = new Date();
    w.setHours(8 + (i % 9), (i*20) % 60, 0, 0);
    s.run(patientIds[(i*3) % patientIds.length], doctorIds[i % doctorIds.length],
      w.toISOString(), 30, t[i % t.length], st[i % st.length], 'Seeded demo appointment');
  }
  return 14;
});

whenEmpty('admissions', () => {
  const beds = db.prepare("SELECT id FROM ward_beds WHERE status = 'Available' ORDER BY id").all().map(r => r.id);
  if (!beds.length) return 0;
  const r = ['Post-operative observation','Chest pain observation','Pneumonia','Dehydration','Fractured femur'];
  const s = db.prepare(`INSERT INTO admissions (patient_id, bed_id, admission_date, reason,
    status, admitting_doctor_id) VALUES (?,?,?,?,?,?)`);
  const n = Math.min(beds.length, patientIds.length);
  for (let i = 0; i < n; i++) {
    const at = new Date(Date.now() - (i+1)*3600000).toISOString();
    s.run(patientIds[i], beds[i], at, r[i % r.length], 'Admitted', doctorIds[i % doctorIds.length]);
    db.prepare("UPDATE ward_beds SET status='Occupied', patient_id=?, admitted_at=? WHERE id=?")
      .run(patientIds[i], at, beds[i]);
  }
  return n;
});

whenEmpty('lab_tests', () => {
  const s = db.prepare(`INSERT INTO lab_tests (patient_id, order_doctor_id, test_name, test_type,
    status, sample_id, ordered_at, completed_at) VALUES (?,?,?,?,?,?,?,?)`);
  const n = ['Complete Blood Count','Glucose','Lipid Panel','Urea & Electrolytes',
    'Liver Function Test','Urinalysis','Thyroid Panel'];
  const st = ['Completed','Collected','Ordered'];
  for (let i = 0; i < 12; i++) {
    const done = st[i % st.length] === 'Completed';
    s.run(patientIds[(i*2) % patientIds.length], doctorIds[i % doctorIds.length],
      n[i % n.length], 'Haematology', st[i % st.length], `SM-${2000+i}`,
      new Date(Date.now() - (i+2)*3600000).toISOString(),
      done ? new Date(Date.now() - (i+1)*3600000).toISOString() : null);
  }
  return 12;
});

whenEmpty('lab_results', () => {
  const tests = db.prepare("SELECT id FROM lab_tests WHERE status='Completed' ORDER BY id").all().map(r => r.id);
  if (!tests.length) return 0;
  const s = db.prepare(`INSERT INTO lab_results (lab_test_id, result_data, reference_range,
    flagged, lab_tech_id, entered_at) VALUES (?,?,?,?,?,?)`);
  for (const id of tests) {
    s.run(id, JSON.stringify({haemoglobin:'13.8 g/dL',wbc:'6.1 x10^9/L',platelets:'250 x10^9/L'}),
      'Hb 13-17 g/dL, WBC 4-11 x10^9/L', 0, labIds[0] || null, new Date().toISOString());
  }
  return tests.length;
});

whenEmpty('consultations', () => {
  const visits = db.prepare('SELECT id, patient_id FROM visits ORDER BY id').all();
  if (!visits.length) return 0;
  const c = ['Fever and headache','Abdominal pain','Cough and breathlessness',
    'Follow-up for hypertension','Lower back pain'];
  const s = db.prepare(`INSERT INTO consultations (visit_id, patient_id, doctor_id, chief_complaint,
    diagnosis, treatment_plan, consultation_date) VALUES (?,?,?,?,?,?,?)`);
  const n = Math.min(visits.length, 8);
  for (let i = 0; i < n; i++) {
    s.run(visits[i].id, visits[i].patient_id, doctorIds[i % doctorIds.length], c[i % c.length],
      pick(['Viral fever','Acute gastritis','Hypertension','Lumbar strain','Type 2 Diabetes'], i),
      'Rest, hydration and follow-up in one week.',
      new Date(Date.now() - i*3600000).toISOString());
  }
  return n;
});

whenEmpty('prescriptions', () => {
  const cs = db.prepare('SELECT id, patient_id, doctor_id FROM consultations ORDER BY id').all();
  if (!cs.length) return 0;
  const m = ['Paracetamol 500mg','Amoxicillin 500mg','Metformin 500mg','Amlodipine 5mg',
    'Omeprazole 20mg','Cetirizine 10mg'];
  const s = db.prepare(`INSERT INTO prescriptions (consultation_id, patient_id, medication_name,
    dosage, frequency, duration_days, instructions, prescribing_doctor_id, status, dispensed)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (let i = 0; i < cs.length; i++) {
    const d = i % 3 === 0;
    s.run(cs[i].id, cs[i].patient_id, m[i % m.length], '1 tablet',
      pick(['Once daily','Twice daily','Three times daily'], i), 7, 'Take after food.',
      cs[i].doctor_id, d ? 'DISPENSED' : 'APPROVED', d ? 1 : 0);
  }
  return cs.length;
});

whenEmpty('medical_history', () => {
  const c = ['Hypertension','Type 2 Diabetes','Asthma','Hypothyroidism','Osteoarthritis','Anaemia'];
  const s = db.prepare(`INSERT INTO medical_history (patient_id, condition, diagnosis_date,
    treatment, status, notes) VALUES (?,?,?,?,?,?)`);
  for (let i = 0; i < 18; i++) {
    s.run(patientIds[i % patientIds.length], c[i % c.length],
      `${2012 + (i%12)}-0${(i%9)+1}-1${i%9}`, 'On regular medication and follow-up.',
      'Active', 'Seeded history entry');
  }
  return 18;
});

whenEmpty('imaging_orders', () => {
  const s = db.prepare(`INSERT INTO imaging_orders (patient_id, ordering_doctor_id, modality,
    body_part, clinical_indication, status, ordered_at, scheduled_at) VALUES (?,?,?,?,?,?,?,?)`);
  const rows = [['X-Ray','Chest','Cough and breathlessness','VERIFIED'],
    ['CT Scan','Head','Head injury observation','ORDERED'],
    ['MRI','Knee','Knee pain','SCHEDULED'],
    ['Ultrasound','Abdomen','Abdominal pain','IN_PROGRESS'],
    ['X-Ray','Wrist','Fractured wrist','RELEASED']];
  for (let i = 0; i < rows.length; i++) {
    s.run(patientIds[(i*4) % patientIds.length], doctorIds[i % doctorIds.length],
      rows[i][0], rows[i][1], rows[i][2], rows[i][3],
      new Date(Date.now() - (i+1)*7200000).toISOString(),
      new Date(Date.now() + (i+1)*3600000).toISOString());
  }
  return rows.length;
});

whenEmpty('imaging_reports', () => {
  const o = db.prepare("SELECT id FROM imaging_orders WHERE status IN ('VERIFIED','RELEASED') ORDER BY id").all().map(r => r.id);
  if (!o.length) return 0;
  const s = db.prepare(`INSERT INTO imaging_reports (imaging_order_id, findings, impression,
    reported_by, verified_by, reported_at) VALUES (?,?,?,?,?,?)`);
  for (const id of o) {
    s.run(id, 'No acute abnormality detected.', 'Normal study',
      labIds[0] || null, doctorIds[0] || null, new Date().toISOString());
  }
  return o.length;
});

whenEmpty('invoices', () => {
  const v = db.prepare('SELECT id, patient_id FROM visits ORDER BY id').all();
  if (!v.length) return 0;
  const s = db.prepare(`INSERT INTO invoices (patient_id, visit_id, invoice_number, total_amount,
    paid_amount, balance, status, insurance_applicable, insurance_status) VALUES (?,?,?,?,?,?,?,?,?)`);
  const st = ['Paid','Unpaid','Partial'];
  for (let i = 0; i < 10; i++) {
    const total = 120 + i*35;
    const paid = st[i%3] === 'Paid' ? total : st[i%3] === 'Partial' ? Math.floor(total/2) : 0;
    // insurance_applicable is a BOOLEAN column: bind 0/1, not a JS boolean.
    s.run(v[i % v.length].patient_id, v[i % v.length].id, `INV-${7000+i}`, total, paid,
      total-paid, st[i%3], i%2 === 0 ? 1 : 0, i%2 === 0 ? 'Approved' : 'Pending');
  }
  return 10;
});

whenEmpty('nursing_notes', () => {
  const a = db.prepare('SELECT id FROM admissions ORDER BY id').all().map(r => r.id);
  if (!a.length || !nurseIds.length) return 0;
  const s = db.prepare(`INSERT INTO nursing_notes (admission_id, nurse_id, note_text, vital_signs,
    note_time) VALUES (?,?,?,?,?)`);
  for (const id of a) {
    s.run(id, nurseIds[0], 'Patient stable, observations within normal limits.',
      JSON.stringify({bp:'120/80',pulse:'78',temp:'36.8',spo2:'98'}), new Date().toISOString());
  }
  return a.length;
});

whenEmpty('notifications', () => {
  const s = db.prepare(`INSERT INTO notifications (recipient_id, type, title, message, is_read,
    created_at) VALUES (?,?,?,?,?,?)`);
  const k = [['appointment','New appointment booked','A patient booked an appointment for tomorrow at 09:00.'],
    ['lab','Lab result ready','Complete Blood Count results are available for review.'],
    ['pharmacy','Low stock alert','Paracetamol is below the reorder threshold.'],
    ['ward','Bed available','A bed has become available in General Ward.'],
    ['billing','Invoice overdue','An invoice is past its due date.']];
  let n = 0;
  for (const uid of staffIds) {
    for (const [type, title, message] of k) {
      s.run(uid, type, title, message, 0, new Date().toISOString());
      n++;
    }
  }
  return n;
});

whenEmpty('pharmacy_inventory', () => {
  const m = db.prepare('SELECT id FROM medications ORDER BY id').all().map(r => r.id);
  if (!m.length) return 0;
  const s = db.prepare(`INSERT INTO pharmacy_inventory (medication_id, batch_number, quantity,
    expiry_date, location, unit_cost) VALUES (?,?,?,?,?,?)`);
  for (const id of m) {
    s.run(id, `BATCH-${3000+id}`, 50 + (id%7)*25, '2027-12-31', `Shelf A${1+(id%4)}`, 2.5 + id*0.15);
  }
  return m.length;
});

// ---------- Procurement: suppliers and purchase orders ----------
// These were previously inserted by a throwaway script. They live here now so a
// fresh clone produces a usable Inventory/Pharmacy "Suppliers" tab.
whenEmpty('suppliers', () => {
  const s = db.prepare(`INSERT INTO suppliers (name, contact_person, email, phone, address,
    lead_time_days, active) VALUES (?,?,?,?,?,?,?)`);
  // `active` is a BOOLEAN column, so bind 1/0 rather than a JS boolean.
  const rows = [
    ['MedSupply Co', 'Alice Ray', 'orders@medsupply.test', '555-0101', '12 Industrial Way, Springfield', 5],
    ['PharmaDirect', 'Ben Ortiz', 'sales@pharmadirect.test', '555-0102', '4 Commerce Park, Springfield', 3],
    ['MedTech Supply', 'Cara Singh', 'hello@medtech.test', '555-0103', '88 Foundry Road, Springfield', 10],
  ];
  for (const r of rows) s.run(r[0], r[1], r[2], r[3], r[4], r[5], 1);
  return rows.length;
});

whenEmpty('purchase_orders', () => {
  const sup = db.prepare('SELECT id FROM suppliers ORDER BY id').all().map(r => r.id);
  const meds = db.prepare('SELECT id, name, unit_price FROM medications ORDER BY id').all();
  if (!sup.length || !meds.length) return 0;

  const head = db.prepare(`INSERT INTO purchase_orders (order_number, supplier_id, status,
    total_amount, expected_date, ordered_by) VALUES (?,?,?,?,?,?)`);
  const item = db.prepare(`INSERT INTO purchase_order_items (purchase_order_id, medication_id,
    item_name, quantity, unit_cost) VALUES (?,?,?,?,?)`);
  const dueIn = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const plans = [[0, 'RECEIVED'], [1, 'ORDERED'], [2, 'SUBMITTED'], [0, 'DRAFT']];

  let made = 0;
  plans.forEach(([supIdx, status], i) => {
    const lines = [
      { md: meds[i % meds.length], qty: 100 + i * 50 },
      { md: meds[(i + 3) % meds.length], qty: 40 + i * 10 },
    ];
    const total = lines.reduce((sum, l) => sum + l.qty * l.md.unit_price, 0);
    const r = head.run(`PO-${9000 + i}`, sup[supIdx % sup.length], status,
      Number(total.toFixed(2)), dueIn(7 + i * 3), adminIds[i % adminIds.length] || null);
    for (const l of lines) {
      item.run(r.lastInsertRowid, l.md.id, l.md.name, l.qty, l.md.unit_price);
    }
    made++;
  });
  return made;
});


// ---------- Emergency: ambulance fleet and dispatch history ----------
whenEmpty('ambulances', () => {
  const s = db.prepare(`INSERT INTO ambulances (unit_number, vehicle_type, crew_size, status,
    current_location) VALUES (?,?,?,?,?)`);
  const rows = [
    ['AMB-01', 'Advanced Life Support', 3, 'Available', 'Central Station'],
    ['AMB-02', 'Basic Life Support', 2, 'Available', 'Central Station'],
    ['AMB-03', 'Advanced Life Support', 3, 'Available', 'North Depot'],
  ];
  for (const r of rows) s.run(r[0], r[1], r[2], r[3], r[4]);
  return rows.length;
});

// Only terminal dispatches are seeded. An open one would leave its unit
// 'Dispatched', which the POST guard would then (correctly) refuse to re-book.
whenEmpty('dispatches', () => {
  const amb = db.prepare('SELECT id FROM ambulances ORDER BY id').all().map(r => r.id);
  if (!amb.length) return 0;
  const s = db.prepare(`INSERT INTO dispatches (ambulance_id, incident_location, incident_type,
    priority, patient_name, destination, dispatched_by, dispatched_at, eta_minutes, status,
    completed_at, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const rows = [
    ['412 Oak Street', 'Cardiac arrest', 'Critical', 'Robert Hill', 'General Hospital ED', 12, 'Completed'],
    ['77 River Road', 'Road traffic accident', 'Emergency', 'Maya Torres', 'General Hospital ED', 18, 'Completed'],
    ['9 Elm Avenue', 'Fall - suspected fracture', 'Urgent', 'Sam Blake', 'General Hospital ED', 22, 'Cancelled'],
  ];
  rows.forEach((r, i) => {
    const at = new Date(Date.now() - (i + 2) * 5400000).toISOString();
    const closed = r[6] === 'Completed' ? at : null;
    const note = r[6] === 'Cancelled'
      ? 'Scene secured; patient transported privately.'
      : 'Transport completed without incident.';
    s.run(amb[i % amb.length], r[0], r[1], r[2], r[3], r[4], adminIds[0] || null, at, r[5],
      r[6], closed, note);
  });
  return rows.length;
});

// ---------- System settings ----------
// system_settings is keyed, so this tops up any missing key without clobbering
// a value an administrator has already changed.
const DEFAULT_SETTINGS = [
  ['hospital_name', 'General Hospital', 'General'],
  ['max_beds', '50', 'General'],
  ['emergency_contact', '555-0000', 'Emergency'],
  ['currency', 'USD', 'Finance'],
];
{
  const ins = db.prepare(`INSERT INTO system_settings (key, value, category) VALUES (?,?,?)
    ON CONFLICT(key) DO NOTHING`);
  let added = 0;
  for (const [k, v, c] of DEFAULT_SETTINGS) added += ins.run(k, v, c).changes;
  report['system_settings'] = added
    ? `${added} rows added (${DEFAULT_SETTINGS.length - added} kept)`
    : `skipped (${DEFAULT_SETTINGS.length} existing)`;
}

// ---------- HR: attendance, leave, payroll, reviews ----------
whenEmpty('employee_attendance', () => {
  if (!personnelIds.length) return 0;
  const s = db.prepare(`INSERT INTO employee_attendance (personnel_id, work_date, clock_in,
    clock_out, status, notes) VALUES (?,?,?,?,?,?)`);
  const st = ['Present', 'Present', 'Present', 'Late', 'Leave', 'Present', 'Absent'];
  let n = 0;
  for (let d = 0; d < 3; d++) {
    const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    personnelIds.forEach((pid, i) => {
      const status = st[(i + d) % st.length];
      const off = status === 'Absent' || status === 'Leave';
      const clockIn = off ? null : new Date(`${day}T0${6 + (i % 3)}:00:00`).toISOString();
      const clockOut = status === 'Present' || status === 'Late'
        ? new Date(new Date(clockIn).getTime() + 8 * 3600000).toISOString() : null;
      s.run(pid, day, clockIn, clockOut, status,
        status === 'Late' ? 'Arrived 25 minutes late.' : null);
      n++;
    });
  }
  return n;
});

whenEmpty('leave_requests', () => {
  if (!personnelIds.length) return 0;
  const s = db.prepare(`INSERT INTO leave_requests (personnel_id, leave_type, start_date,
    end_date, days, reason, status, reviewed_by, reviewed_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  const rows = [
    ['Annual', 5, 'Family holiday', 'Approved'],
    ['Sick', 2, 'Influenza', 'Pending'],
    ['Parental', 14, 'Newborn care', 'Approved'],
    ['Unpaid', 3, 'Personal matters', 'Rejected'],
    ['Annual', 7, 'Wedding abroad', 'Pending'],
  ];
  const day = (x) => new Date(Date.now() + x * 86400000).toISOString().slice(0, 10);
  rows.forEach((r, i) => {
    const start = 4 + i * 3;
    const decided = r[3] !== 'Pending';
    s.run(personnelIds[i % personnelIds.length], r[0], day(start), day(start + r[1] - 1), r[1], r[2],
      r[3], decided ? (adminIds[0] || null) : null, decided ? new Date().toISOString() : null);
  });
  return rows.length;
});

whenEmpty('payroll_records', () => {
  if (!personnelIds.length) return 0;
  const s = db.prepare(`INSERT INTO payroll_records (personnel_id, pay_period, basic_salary,
    allowances, deductions, net_pay, status, processed_by, processed_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const period = new Date().toISOString().slice(0, 7);
  const st = ['Paid', 'Approved', 'Draft'];
  let n = 0;
  personnelIds.forEach((pid, i) => {
    const basic = 3200 + (i % 5) * 450;
    const allowances = 250 + (i % 3) * 100;
    const deductions = 180 + (i % 4) * 60;
    // Mirrors the server rule exactly: net = basic + allowances - deductions.
    const net = basic + allowances - deductions;
    s.run(pid, period, basic, allowances, deductions, net, st[i % st.length],
      adminIds[0] || null, new Date().toISOString());
    n++;
  });
  return n;
});

whenEmpty('performance_reviews', () => {
  if (!personnelIds.length) return 0;
  const s = db.prepare(`INSERT INTO performance_reviews (personnel_id, review_period, rating,
    strengths, improvements, goals, reviewer_id, status) VALUES (?,?,?,?,?,?,?,?)`);
  const now = new Date();
  const period = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  const st = ['Draft', 'Shared', 'Acknowledged'];
  const strengths = ['Excellent patient communication', 'Strong clinical documentation',
    'Reliable team player', 'Mentors junior staff well'];
  const improvements = ['Delegate more effectively', 'Time management during peak hours',
    'Increase CPD participation', 'Escalate concerns earlier'];
  let n = 0;
  personnelIds.forEach((pid, i) => {
    s.run(pid, period, 3 + (i % 3), strengths[i % strengths.length],
      improvements[i % improvements.length], 'Complete annual mandatory training.',
      adminIds[0] || null, st[i % st.length]);
    n++;
  });
  return n;
});

console.log(`Demo data seeded into ${DB_PATH}\n`);
for (const [t, r] of Object.entries(report)) console.log(`  ${t.padEnd(22)} ${r}`);
db.close();
