import { getDb, getPatientByGlobalId, getPatientById, getPatientVisits, getMedicalHistory, getConsultationsByPatient, getPrescriptionsByPatient, getInvoicesByPatient, getLabTestsByPatient, getAdmissionsByPatient, getLatestIoTTelemetry } from '../models/index.js';

export function buildPatientProfile(globalId) {
  const patient = getPatientByGlobalId(globalId);
  if (!patient) return null;

  const visits = getPatientVisits(patient.id);
  const medicalHistory = getMedicalHistory(patient.id);
  const consultations = getConsultationsByPatient(patient.id);
  const prescriptions = getPrescriptionsByPatient(patient.id);
  const invoices = getInvoicesByPatient(patient.id);
  const labTests = getLabTestsByPatient(patient.id);
  const admissions = getAdmissionsByPatient(patient.id);
  const telemetry = getLatestIoTTelemetry(patient.id);

  const unpaidInvoices = invoices.filter(i => i.status !== 'Paid');
  const totalBalance = unpaidInvoices.reduce((sum, i) => sum + i.balance, 0);

  return {
    patient: {
      id: patient.id,
      global_id: patient.global_id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      blood_type: patient.blood_type,
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      emergency_contact_name: patient.emergency_contact_name,
      emergency_contact_phone: patient.emergency_contact_phone,
      insurance_provider: patient.insurance_provider,
      insurance_id: patient.insurance_id,
      insurance_validity: patient.insurance_validity,
      medical_history_summary: patient.medical_history_summary,
    },
    billing: {
      total_unpaid: totalBalance,
      unpaid_count: unpaidInvoices.length,
      last_invoice_status: invoices.length > 0 ? invoices[0].status : 'None',
    },
    summaries: {
      visit_count: visits.length,
      consultation_count: consultations.length,
      prescription_count: prescriptions.length,
      lab_test_count: labTests.length,
      admission_count: admissions.length,
      telemetry_count: telemetry.length,
    },
    recent: {
      visits: visits.slice(0, 5),
      consultations: consultations.slice(0, 5),
      prescriptions: prescriptions.slice(0, 10),
      lab_tests: labTests.slice(0, 10),
      admissions: admissions.slice(0, 5),
      telemetry: telemetry.slice(0, 10),
    },
    medical_history: medicalHistory,
  };
}

export function buildPatientRoutingEngine(globalId) {
  const profile = buildPatientProfile(globalId);
  if (!profile) return null;

  return {
    globalId,
    status: 'ACTIVE',
    pathways: {
      reception: { available: true, next_action: 'Check-in for visit' },
      clinical: { available: true, next_action: 'Schedule consultation' },
      oncology: { available: true, next_action: 'Oncology assessment' },
      billing: { available: true, balance: profile.billing.total_unpaid, action: profile.billing.total_unpaid > 0 ? 'Payment required' : 'Clear' },
      laboratory: { available: true, pending_tests: profile.summaries.lab_test_count, action: 'Order tests' },
      ward: { available: profile.admission_count > 0, next_action: 'View ward status' },
      iot: { available: true, devices: profile.summaries.telemetry_count, action: 'Monitor devices' },
      or: { available: false, next_action: 'Schedule surgery' },
    },
    priority_flags: {
      requires_payment: profile.billing.total_unpaid > 0,
      requires_consultation: profile.summaries.consultation_count === 0,
      open_lab_tests: profile.summaries.lab_test_count > 0,
      active_admission: profile.admission_count > 0,
      insurance_expiring: profile.patient.insurance_validity ? new Date(profile.patient.insurance_validity) < new Date(Date.now() + 30 * 86400000) : false,
    },
  };
}

export function getPatientDashboard(globalId) {
  const profile = buildPatientProfile(globalId);
  const routing = buildPatientRoutingEngine(globalId);
  return { profile, routing };
}
