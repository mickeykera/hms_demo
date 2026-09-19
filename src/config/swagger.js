import swaggerJsdoc from 'swagger-jsdoc';

const routeGroups = {
  Auth: [
    ['post', '/api/auth/login'],
  ],
  Setup: [
    ['get', '/api/setup-demo'],
    ['post', '/api/setup-demo'],
  ],
  Reception: [
    ['post', '/api/reception/register'], ['post', '/api/reception/{globalId}/checkin'],
    ['get', '/api/reception/{globalId}'], ['put', '/api/reception/{globalId}'],
    ['get', '/api/reception/{globalId}/dashboard'], ['get', '/api/reception/queue/{department}'],
    ['get', '/api/reception/search'],
  ],
  Clinical: [
    ['get', '/api/clinical/doctors'], ['post', '/api/clinical/consult'], ['get', '/api/clinical/{patientId}'],
    ['post', '/api/clinical/{patientId}/history'], ['post', '/api/clinical/{patientId}/prescription'],
    ['get', '/api/clinical/{patientId}/prescriptions'], ['get', '/api/clinical/{patientId}/emr'],
  ],
  Billing: [
    ['post', '/api/billing/invoice'], ['get', '/api/billing/{patientId}'],
    ['put', '/api/billing/{id}/pay'], ['put', '/api/billing/{id}/insurance-check'],
    ['get', '/api/billing/status/{patientId}'],
  ],
  Laboratory: [
    ['post', '/api/lab/order'], ['get', '/api/lab/{patientId}'],
    ['post', '/api/lab/{testId}/result'], ['get', '/api/lab/{patientId}/sync-to-emr'],
  ],
  Ward: [
    ['post', '/api/ward/admit'], ['post', '/api/ward/discharge/{patientId}'],
    ['get', '/api/ward/{patientId}'], ['post', '/api/ward/{admissionId}/notes'], ['get', '/api/ward/beds'],
  ],
  IoT: [
    ['post', '/api/iot/webhook'], ['get', '/api/iot/{patientId}'], ['get', '/api/iot/{patientId}/latest'],
  ],
  'Operating Room': [
    ['post', '/api/or/schedule'], ['post', '/api/or/{scheduleId}/team'],
    ['get', '/api/or/{scheduleId}'], ['post', '/api/or/{scheduleId}/report'],
  ],
  Appointments: [
    ['get', '/api/appointments'], ['post', '/api/appointments'], ['get', '/api/appointments/{id}'],
    ['put', '/api/appointments/{id}'], ['put', '/api/appointments/{id}/status'],
    ['get', '/api/appointments/doctor/{doctorId}/schedule'],
  ],
  Pharmacy: [
    ['get', '/api/pharmacy/medications'], ['post', '/api/pharmacy/medications'],
    ['get', '/api/pharmacy/inventory'], ['post', '/api/pharmacy/inventory'],
    ['get', '/api/pharmacy/prescriptions/{patientId}'], ['post', '/api/pharmacy/dispense'],
    ['get', '/api/pharmacy/dispensing-history/{patientId}'], ['get', '/api/pharmacy/low-stock'],
    ['get', '/api/pharmacy/expiring'],
  ],
};

function routeDocs() {
  return Object.fromEntries(Object.entries(routeGroups).flatMap(([tag, routes]) => routes.map(([method, path]) => [
    path,
    {
      [method]: {
        tags: [tag],
        summary: `${method.toUpperCase()} ${path}`,
        ...(method === 'post' && path === '/api/auth/login' ? { security: [] } : {}),
        responses: {
          200: { description: 'Successful response' },
          401: { description: 'Authentication required' },
        },
      },
    },
  ])));
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hospital Management System API',
      version: '1.0.0',
      description: 'A comprehensive hospital management system with modules for Reception, Clinical, Billing, Laboratory, Ward, IoT, and Operating Room',
      contact: {
        name: 'Hospital Management Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Patient: {
          type: 'object',
          required: ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone'],
          properties: {
            id: { type: 'integer' },
            global_id: { type: 'string', example: 'HMS-ABC123-XYZ789' },
            first_name: { type: 'string', example: 'John' },
            last_name: { type: 'string', example: 'Doe' },
            date_of_birth: { type: 'string', format: 'date', example: '1990-01-15' },
            gender: { type: 'string', enum: ['Male', 'Female', 'Other', 'PreferNotToSay'] },
            blood_type: { type: 'string', example: 'O+' },
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            phone: { type: 'string', example: '555-1234' },
            address: { type: 'string' },
            emergency_contact_name: { type: 'string' },
            emergency_contact_phone: { type: 'string' },
            insurance_provider: { type: 'string' },
            insurance_id: { type: 'string' },
            insurance_validity: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Visit: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            patient_id: { type: 'integer' },
            visit_type: { type: 'string', enum: ['WalkIn', 'Scheduled', 'Emergency', 'FollowUp'] },
            triage_priority: { type: 'integer', minimum: 1, maximum: 5 },
            queue_position: { type: 'integer' },
            department: { type: 'string' },
            status: { type: 'string', enum: ['Waiting', 'InConsultation', 'Completed', 'Cancelled'] },
            check_in_time: { type: 'string', format: 'date-time' },
            check_out_time: { type: 'string', format: 'date-time' },
          },
        },
        Consultation: {
          type: 'object',
          required: ['visit_id', 'patient_id', 'doctor_id', 'chief_complaint'],
          properties: {
            id: { type: 'integer' },
            visit_id: { type: 'integer' },
            patient_id: { type: 'integer' },
            doctor_id: { type: 'integer' },
            chief_complaint: { type: 'string' },
            diagnosis: { type: 'string' },
            treatment_plan: { type: 'string' },
            notes: { type: 'string' },
            consultation_date: { type: 'string', format: 'date-time' },
          },
        },
        Prescription: {
          type: 'object',
          required: ['consultation_id', 'patient_id', 'medication_name', 'dosage', 'frequency'],
          properties: {
            id: { type: 'integer' },
            consultation_id: { type: 'integer' },
            patient_id: { type: 'integer' },
            medication_name: { type: 'string' },
            dosage: { type: 'string' },
            frequency: { type: 'string' },
            duration_days: { type: 'integer' },
            instructions: { type: 'string' },
            prescribing_doctor_id: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Invoice: {
          type: 'object',
          required: ['patient_id', 'total_amount'],
          properties: {
            id: { type: 'integer' },
            patient_id: { type: 'integer' },
            visit_id: { type: 'integer' },
            invoice_number: { type: 'string', example: 'INV-ABC123' },
            total_amount: { type: 'number', example: 150.00 },
            paid_amount: { type: 'number', example: 0 },
            balance: { type: 'number', example: 150.00 },
            status: { type: 'string', enum: ['Unpaid', 'Partial', 'Paid', 'Cancelled'] },
            insurance_applicable: { type: 'boolean' },
            insurance_status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        LabTest: {
          type: 'object',
          required: ['patient_id', 'test_name', 'sample_id'],
          properties: {
            id: { type: 'integer' },
            patient_id: { type: 'integer' },
            order_doctor_id: { type: 'integer' },
            test_name: { type: 'string' },
            test_type: { type: 'string' },
            status: { type: 'string', enum: ['Ordered', 'Collected', 'Processing', 'Completed', 'Cancelled'] },
            sample_id: { type: 'string' },
            ordered_at: { type: 'string', format: 'date-time' },
            completed_at: { type: 'string', format: 'date-time' },
          },
        },
        LabResult: {
          type: 'object',
          required: ['lab_test_id', 'result_data'],
          properties: {
            id: { type: 'integer' },
            lab_test_id: { type: 'integer' },
            result_data: { type: 'string' },
            reference_range: { type: 'string' },
            flagged: { type: 'boolean' },
            lab_tech_id: { type: 'integer' },
            entered_at: { type: 'string', format: 'date-time' },
          },
        },
        Admission: {
          type: 'object',
          required: ['patient_id', 'bed_id', 'reason'],
          properties: {
            id: { type: 'integer' },
            patient_id: { type: 'integer' },
            bed_id: { type: 'integer' },
            admission_date: { type: 'string', format: 'date-time' },
            discharge_date: { type: 'string', format: 'date-time' },
            reason: { type: 'string' },
            status: { type: 'string', enum: ['Admitted', 'Discharged', 'Transferred'] },
            admitting_doctor_id: { type: 'integer' },
          },
        },
        IoTTelemetry: {
          type: 'object',
          required: ['patient_id', 'device_type', 'device_id', 'telemetry_data'],
          properties: {
            id: { type: 'integer' },
            patient_id: { type: 'integer' },
            device_type: { type: 'string' },
            device_id: { type: 'string' },
            telemetry_data: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ORSchedule: {
          type: 'object',
          required: ['patient_id', 'procedure_name', 'scheduled_date', 'surgeon_id'],
          properties: {
            id: { type: 'integer' },
            patient_id: { type: 'integer' },
            procedure_name: { type: 'string' },
            scheduled_date: { type: 'string', format: 'date-time' },
            surgeon_id: { type: 'integer' },
            anesthesiologist_id: { type: 'integer' },
            status: { type: 'string', enum: ['Scheduled', 'InProgress', 'Completed', 'Cancelled'] },
            prep_complete: { type: 'boolean' },
            notes: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'object' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                full_name: { type: 'string' },
                role: { type: 'string' },
                department: { type: 'string' },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: routeDocs(),
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Reception', description: 'Patient registration and check-in' },
      { name: 'Clinical', description: 'Clinical consultations, prescriptions, and EMR' },
      { name: 'Billing', description: 'Invoice management and payments' },
      { name: 'Laboratory', description: 'Lab test ordering and results' },
      { name: 'Ward', description: 'Patient admissions and ward management' },
      { name: 'IoT', description: 'IoT device telemetry' },
      { name: 'Operating Room', description: 'Surgery scheduling and reports' },
    ],
  },
  apis: ['./src/modules/**/routes.js', './src/server.js'],
};

export const swaggerSpec = swaggerJsdoc(options);