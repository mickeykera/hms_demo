import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authService = {
  login: (username, password) => api.post('/auth/login', { username, password }),
};

export const patientService = {
  register: (data) => api.post('/reception/register', data),
  checkin: (globalId, data) => api.post(`/reception/${globalId}/checkin`, data),
  get: (globalId) => api.get(`/reception/${globalId}`),
  update: (globalId, data) => api.put(`/reception/${globalId}`, data),
  dashboard: (globalId) => api.get(`/reception/${globalId}/dashboard`),
  queue: (department) => api.get(`/reception/queue/${department}`),
  search: (query) => api.get(`/reception/search?q=${encodeURIComponent(query)}`),
  portal: {
    me: () => api.get('/patient/me'),
    appointments: () => api.get('/patient/appointments'),
    prescriptions: () => api.get('/patient/prescriptions'),
    labResults: () => api.get('/patient/lab-results'),
    invoices: () => api.get('/patient/invoices'),
  },
};

export const clinicalService = {
  consult: (data) => api.post('/clinical/consult', data),
  getPatient: (patientId) => api.get(`/clinical/${patientId}`),
  addHistory: (patientId, data) => api.post(`/clinical/${patientId}/history`, data),
  addPrescription: (patientId, data) => api.post(`/clinical/${patientId}/prescription`, data),
  getPrescriptions: (patientId) => api.get(`/clinical/${patientId}/prescriptions`),
  getEMR: (patientId) => api.get(`/clinical/${patientId}/emr`),
  getDoctors: () => api.get('/clinical/doctors').then((res) => res.data.doctors || []),
};

export const billingService = {
  createInvoice: (data) => api.post('/billing/invoice', data),
  getInvoices: (patientId) => api.get(`/billing/${patientId}`),
  pay: (id, amount) => api.put(`/billing/${id}/pay`, { amount }),
  insuranceCheck: (id, data) => api.put(`/billing/${id}/insurance-check`, data),
  status: (patientId) => api.get(`/billing/status/${patientId}`),
};

export const labService = {
  order: (data) => api.post('/lab/order', data),
  getTests: (patientId) => api.get(`/lab/${patientId}`),
  addResult: (testId, data) => api.post(`/lab/${testId}/result`, data),
  syncToEMR: (patientId) => api.get(`/lab/${patientId}/sync-to-emr`),
};

export const wardService = {
  admit: (data) => api.post('/ward/admit', data),
  discharge: (patientId) => api.post(`/ward/discharge/${patientId}`),
  getAdmission: (patientId) => api.get(`/ward/${patientId}`),
  addNote: (admissionId, data) => api.post(`/ward/${admissionId}/notes`, data),
  getBeds: () => api.get('/ward/beds'),
};

export const iotService = {
  webhook: (data) => api.post('/iot/webhook', data),
  getTelemetry: (patientId) => api.get(`/iot/${patientId}`),
  getLatest: (patientId) => api.get(`/iot/${patientId}/latest`),
};

export const orService = {
  schedule: (data) => api.post('/or/schedule', data),
  addTeam: (scheduleId, data) => api.post(`/or/${scheduleId}/team`, data),
  getSchedule: (scheduleId) => api.get(`/or/${scheduleId}`),
  addReport: (scheduleId, data) => api.post(`/or/${scheduleId}/report`, data),
};

export const appointmentsService = {
  list: (params) => api.get('/appointments', { params }),
  create: (data) => api.post('/appointments', data),
  get: (id) => api.get(`/appointments/${id}`),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  updateStatus: (id, status) => api.put(`/appointments/${id}/status`, { status }),
  doctorSchedule: (doctorId, date) => api.get(`/appointments/doctor/${doctorId}/schedule`, { params: { date } }),
};

export const pharmacyService = {
  getMedications: () => api.get('/pharmacy/medications'),
  createMedication: (data) => api.post('/pharmacy/medications', data),
  getInventory: () => api.get('/pharmacy/inventory'),
  addInventory: (data) => api.post('/pharmacy/inventory', data),
  getPrescriptions: (patientId) => api.get(`/pharmacy/prescriptions/${patientId}`),
  dispense: (data) => api.post('/pharmacy/dispense', data),
  getHistory: (patientId) => api.get(`/pharmacy/dispensing-history/${patientId}`),
  lowStock: (threshold) => api.get('/pharmacy/low-stock', { params: { threshold } }),
  expiring: (days) => api.get('/pharmacy/expiring', { params: { days } }),
};