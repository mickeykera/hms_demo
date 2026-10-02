import { z } from 'zod';

export const schemas = {
  // ---------- Procurement ----------
  supplier: z.object({
    name: z.string().min(1, 'Supplier name is required'),
    contact_person: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    lead_time_days: z.coerce.number().int().min(0).optional(),
    active: z.coerce.boolean().optional(),
  }),

  supplierUpdate: z.object({
    name: z.string().min(1).optional(),
    contact_person: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    lead_time_days: z.coerce.number().int().min(0).optional(),
    active: z.coerce.boolean().optional(),
  }),

  purchaseOrder: z.object({
    supplier_id: z.coerce.number().int().positive(),
    expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    items: z.array(z.object({
      medication_id: z.coerce.number().int().positive().optional(),
      item_name: z.string().min(1, 'Item name is required'),
      quantity: z.coerce.number().int().positive(),
      unit_cost: z.coerce.number().min(0).default(0),
    })).min(1, 'At least one line item is required'),
  }),

  // ---------- HR ----------
  attendance: z.object({
    personnel_id: z.coerce.number().int().positive(),
    work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    clock_in: z.string().optional(),
    clock_out: z.string().optional(),
    status: z.enum(['Present', 'Absent', 'Late', 'Leave', 'HalfDay']).default('Present'),
    notes: z.string().optional(),
  }),

  leaveRequest: z.object({
    personnel_id: z.coerce.number().int().positive(),
    leave_type: z.enum(['Annual', 'Sick', 'Parental', 'Unpaid', 'Other']),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.coerce.number().positive(),
    reason: z.string().optional(),
  }),

  leaveDecision: z.object({
    status: z.enum(['Approved', 'Rejected', 'Cancelled']),
  }),

  payroll: z.object({
    personnel_id: z.coerce.number().int().positive(),
    pay_period: z.string().min(1, 'Pay period is required'),
    basic_salary: z.coerce.number().min(0),
    allowances: z.coerce.number().min(0).default(0),
    deductions: z.coerce.number().min(0).default(0),
    // net_pay is derived server-side; accepted here only for display parity.
    net_pay: z.coerce.number().optional(),
    status: z.enum(['Draft', 'Approved', 'Paid']).default('Draft'),
  }),

  performanceReview: z.object({
    personnel_id: z.coerce.number().int().positive(),
    review_period: z.string().min(1, 'Review period is required'),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    strengths: z.string().optional(),
    improvements: z.string().optional(),
    goals: z.string().optional(),
    status: z.enum(['Draft', 'Shared', 'Acknowledged']).default('Draft'),
  }),

  // ---------- Emergency ----------
  ambulance: z.object({
    unit_number: z.string().min(1, 'Unit number is required'),
    vehicle_type: z.string().optional(),
    crew_size: z.coerce.number().int().min(0).optional(),
    status: z.enum(['Available', 'Dispatched', 'EnRoute', 'Returning', 'OutOfService']).default('Available'),
    current_location: z.string().optional(),
  }),

  dispatch: z.object({
    ambulance_id: z.coerce.number().int().positive().optional(),
    incident_location: z.string().min(1, 'Incident location is required'),
    incident_type: z.string().optional(),
    priority: z.enum(['Routine', 'Urgent', 'Emergency', 'Critical']).default('Routine'),
    patient_name: z.string().optional(),
    destination: z.string().optional(),
    eta_minutes: z.coerce.number().int().min(0).optional(),
    notes: z.string().optional(),
  }),

  dispatchStatus: z.object({
    status: z.enum(['Dispatched', 'EnRoute', 'AtScene', 'Returning', 'Completed', 'Cancelled']),
  }),

  // ---------- Settings ----------
  systemSetting: z.object({
    value: z.string().optional(),
    category: z.string().optional(),
  }),

  patientRegister: z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    gender: z.enum(['Male', 'Female', 'Other', 'PreferNotToSay']),
    blood_type: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().min(1, 'Phone is required'),
    address: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    insurance_provider: z.string().optional(),
    insurance_id: z.string().optional(),
    insurance_validity: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  }),

  patientCheckin: z.object({
    triage_priority: z.number().int().min(1).max(5).optional(),
  }),

  consultation: z.object({
    visit_id: z.number().int().positive(),
    patient_id: z.number().int().positive(),
    doctor_id: z.number().int().positive(),
    chief_complaint: z.string().min(1, 'Chief complaint is required'),
    diagnosis: z.string().optional(),
    treatment_plan: z.string().optional(),
    notes: z.string().optional(),
    // SOAP sections. Optional individually so a note can be drafted
    // incrementally; only Subjective/Assessment/Plan are enforced at signing.
    subjective: z.string().optional(),
    objective: z.string().optional(),
    assessment: z.string().optional(),
    plan: z.string().optional(),
  }),

  // Draft save of an existing note. chief_complaint stays optional here so a
  // partially written note is never rejected by the autosave.
  soapNote: z.object({
    chief_complaint: z.string().optional(),
    subjective: z.string().optional(),
    objective: z.string().optional(),
    assessment: z.string().optional(),
    plan: z.string().optional(),
    diagnosis: z.string().optional(),
  }),

  prescription: z.object({
    consultation_id: z.number().int().positive(),
    medication_name: z.string().min(1, 'Medication name is required'),
    dosage: z.string().min(1, 'Dosage is required'),
    frequency: z.string().min(1, 'Frequency is required'),
    duration_days: z.number().int().positive().optional(),
    instructions: z.string().optional(),
  }),

  invoice: z.object({
    patient_id: z.number().int().positive(),
    visit_id: z.number().int().positive().optional(),
    total_amount: z.number().positive(),
    insurance_applicable: z.boolean().optional(),
  }),

  payment: z.object({
    amount: z.number().positive(),
  }),

  labOrder: z.object({
    patient_id: z.number().int().positive(),
    test_name: z.string().min(1, 'Test name is required'),
    test_type: z.string().optional(),
    sample_id: z.string().min(1, 'Sample ID is required'),
  }),

  labResult: z.object({
    result_data: z.string().min(1, 'Result data is required'),
    reference_range: z.string().optional(),
    flagged: z.boolean().optional(),
  }),

  medication: z.object({
    name: z.string().min(1),
    generic_name: z.string().optional(),
    strength: z.string().optional(),
    form: z.enum(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Patch', 'Other']).optional(),
    manufacturer: z.string().optional(),
    unit_price: z.number().positive().optional(),
    requires_prescription: z.boolean().default(true),
    controlled_substance: z.boolean().default(false),
    description: z.string().optional(),
  }),

  inventory: z.object({
    medication_id: z.number().int().positive(),
    batch_number: z.string().min(1),
    quantity: z.number().int().min(0),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().optional(),
    unit_cost: z.number().positive().optional(),
  }),

  dispense: z.object({
    prescription_id: z.number().int().positive(),
    medication_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
    instructions: z.string().optional(),
    dispensed_by: z.number().int().positive(),
  }),

  admission: z.object({
    patient_id: z.number().int().positive(),
    bed_id: z.number().int().positive(),
    reason: z.string().min(1, 'Reason is required'),
  }),

  nursingNote: z.object({
    note_text: z.string().min(1, 'Note text is required'),
    vital_signs: z.string().optional(),
  }),

  iotTelemetry: z.object({
    patient_id: z.number().int().positive(),
    device_type: z.string().min(1, 'Device type is required'),
    device_id: z.string().min(1, 'Device ID is required'),
    telemetry_data: z.string().min(1, 'Telemetry data is required'),
  }),

  orSchedule: z.object({
    patient_id: z.number().int().positive(),
    procedure_name: z.string().min(1, 'Procedure name is required'),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'Invalid datetime format'),
    surgeon_id: z.number().int().positive(),
    anesthesiologist_id: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),

  orTeam: z.object({
    member_id: z.number().int().positive(),
    role: z.string().min(1, 'Role is required'),
  }),

  surgicalReport: z.object({
    procedure_notes: z.string().optional(),
    complications: z.string().optional(),
    outcome: z.string().optional(),
    surgeon_notes: z.string().optional(),
    post_op_care_instructions: z.string().optional(),
  }),

  medicalHistory: z.object({
    condition: z.string().min(1, 'Condition is required'),
    diagnosis_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    treatment: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
  }),

  login: z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  }),

  appointment: z.object({
    patient_id: z.coerce.number().int().positive(),
    doctor_id: z.coerce.number().int().positive(),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'Invalid datetime format'),
    duration_minutes: z.coerce.number().int().positive().default(30),
    appointment_type: z.enum(['Consultation', 'FollowUp', 'Procedure', 'Checkup']).default('Consultation'),
    notes: z.string().optional(),
  }),

  appointmentUpdate: z.object({
    patient_id: z.coerce.number().int().positive().optional(),
    doctor_id: z.coerce.number().int().positive().optional(),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).optional(),
    duration_minutes: z.coerce.number().int().positive().optional(),
    appointment_type: z.enum(['Consultation', 'FollowUp', 'Procedure', 'Checkup']).optional(),
    notes: z.string().optional(),
  }),

  // Update is an allow-list, not a passthrough.
  //
  // This route used to hand `req.body` straight to updatePatient(), which
  // interpolates the incoming keys into `SET column = ?`. That made `id` and
  // `global_id` (the business key used by every other patient route)
  // overwritable, and any other key a caller invented became a column name in
  // the generated SQL. Zod strips unknown keys, so an explicit allow-list
  // closes both.
  patientUpdate: z.object({
    first_name: z.string().min(1, 'First name is required').optional(),
    last_name: z.string().min(1, 'Last name is required').optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    gender: z.enum(['Male', 'Female', 'Other', 'PreferNotToSay']).optional(),
    blood_type: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().min(1, 'Phone is required').optional(),
    address: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    insurance_provider: z.string().optional(),
    insurance_id: z.string().optional(),
    insurance_validity: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    medical_history_summary: z.string().optional(),
    // Every field is optional because this is a partial update: callers send
    // only what they are changing. The refine stops a fully empty body, which
    // would otherwise build `UPDATE patients SET , updated_at = ...` -- invalid
    // SQL surfaced to the client as a misleading 500.
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  }),

  personnel: z.object({
    employee_id: z.string().min(1),
    user_id: z.number().int().positive().optional(),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    middle_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    gender: z.enum(['Male', 'Female', 'Other', 'PreferNotToSay']).optional(),
    hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    employment_status: z.enum(['Active', 'OnLeave', 'Terminated', 'Retired']).default('Active'),
    professional_title: z.string().optional(),
    license_number: z.string().optional(),
    license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    department_id: z.number().int().positive().optional(),
    role_id: z.number().int().positive().optional(),
    supervisor_id: z.number().int().positive().optional(),
    work_schedule: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
  }),

  role: z.object({
    name: z.string().min(1),
    display_name: z.string().min(1),
    description: z.string().optional(),
    hierarchy_level: z.number().int().min(1).max(10).default(1),
  }),

  permission: z.object({
    name: z.string().min(1),
    display_name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().min(1),
  }),

  department: z.object({
    name: z.string().min(1),
    code: z.string().min(1).max(10),
    description: z.string().optional(),
    parent_department_id: z.number().int().positive().optional(),
  }),

  request: z.object({
    requesting_department_id: z.number().int().positive(),
    receiving_department_id: z.number().int().positive(),
    patient_id: z.number().int().positive(),
    request_type: z.enum(['LabTest', 'Imaging', 'Pharmacy', 'Consultation', 'Referral', 'Admission', 'Transfer', 'Procedure', 'Other']),
    priority: z.enum(['Routine', 'Urgent', 'Stat', 'Emergency']).default('Routine'),
    clinical_details: z.string().optional(),
    notes: z.string().optional(),
    attachments: z.string().optional(),
  }),

  updateStatus: z.object({
    status: z.enum(['Pending', 'Accepted', 'InProgress', 'Completed', 'Verified', 'Cancelled', 'Rejected']),
  }),

  updateResult: z.object({
    result_data: z.string().min(1),
    result_notes: z.string().optional(),
  }),

  ward: z.object({
    name: z.string().min(1),
    building: z.string().optional(),
    floor: z.number().int().optional(),
    ward_type: z.enum(['General', 'ICU', 'NICU', 'PICU', 'Emergency', 'Maternity', 'Psychiatric', 'Isolation', 'Recovery']).optional(),
    capacity: z.number().int().positive().optional(),
    nursing_station_phone: z.string().optional(),
  }),

  room: z.object({
    ward_id: z.number().int().positive(),
    room_number: z.string().min(1),
    room_type: z.enum(['General', 'Private', 'ICU', 'Isolation', 'Procedure', 'Consultation']).optional(),
    capacity: z.number().int().positive().default(1),
  }),

  bed: z.object({
    ward_name: z.string().min(1),
    bed_number: z.string().min(1),
    bed_type: z.enum(['General', 'Private', 'ICU', 'Isolation']),
    status: z.enum(['Available', 'Occupied', 'Reserved', 'Maintenance']).default('Available'),
  }),
};

export function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: `Validation schema '${schemaName}' not found` });
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.validated = result.data;
    next();
  };
}