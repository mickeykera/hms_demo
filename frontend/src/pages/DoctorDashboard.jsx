import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Users, FileText, Pill, FlaskConical, Activity,
  Heart, AlertTriangle, Clock, CheckCircle, Stethoscope, Search,
  Plus, Eye, Edit, TrendingUp, Bell, MessageSquare, ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';
import OrderLabsModal from '../components/OrderLabsModal';
import SoapNoteModal from '../components/SoapNoteModal';
import PrescriptionModal from '../components/PrescriptionModal';
import ImagingOrderModal from '../components/ImagingOrderModal';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'my-patients', label: 'My Patients', icon: Users },
  { id: 'consultations', label: 'Consultations', icon: Stethoscope },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'lab-results', label: 'Lab Results', icon: FlaskConical },
  { id: 'imaging', label: 'Imaging', icon: Activity },
  { id: 'referrals', label: 'Referrals', icon: MessageSquare },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

// Prescriptions attached to one consultation. Fetched per-consultation
// because the API is patient-scoped rather than consultation-scoped.
function ConsultationPrescriptions({ consultationId }) {
  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['pharmacy-rx', consultationId],
    queryFn: async () => {
      // The prescriptions endpoint is patient-scoped, so resolve the patient
      // through the consultation first.
      const consults = await api.get('/clinical/consultations').then(r => r.data.consultations || []);
      const consult = consults.find(c => String(c.id) === String(consultationId));
      if (!consult) return [];
      const res = await api.get(`/clinical/${consult.patient_id}/prescriptions`);
      return (res.data.prescriptions || []).filter(p => p.consultation_id === consultationId);
    },
    enabled: !!consultationId,
  });

  if (isLoading) return <p className="text-xs text-gray-400">Loading prescriptions…</p>;
  if (!prescriptions.length) {
    return <p className="text-xs text-gray-400">No prescriptions for this encounter.</p>;
  }
  return (
    <ul className="space-y-1 mt-2">
      {prescriptions.map(p => (
        <li key={p.id} className="text-xs text-gray-700 flex items-center gap-2">
          <Pill className="w-3 h-3 text-green-600 flex-shrink-0" />
          <span className="font-medium">{p.medication_name}</span>
          <span className="text-gray-500">{p.dosage} • {p.frequency}</span>
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{p.status}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DoctorDashboard() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview', { patients: 'my-patients' });
  const [searchQuery, setSearchQuery] = useState('');
  // Order Labs overlay + the patient it defaults to (set by "Order Labs"
  // buttons on individual patient rows/cards).
  const [orderLabsOpen, setOrderLabsOpen] = useState(false);
  const [orderLabsPatientId, setOrderLabsPatientId] = useState('');

  const openOrderLabs = patientId => {
    setOrderLabsPatientId(patientId || '');
    setOrderLabsOpen(true);
  };

  // SOAP charting overlay for a specific patient.
  const [soapOpen, setSoapOpen] = useState(false);
  const [soapPatient, setSoapPatient] = useState(null);

  const openSoap = patient => {
    setSoapPatient(patient);
    setSoapOpen(true);
  };

  // Prescription overlay. `rxConsultationId` links the order to a specific
  // encounter; when omitted the modal falls back to the latest consultation.
  const [rxOpen, setRxOpen] = useState(false);
  const [rxPatient, setRxPatient] = useState(null);
  const [rxConsultationId, setRxConsultationId] = useState(null);

  const openRx = (patient, consultationId) => {
    setRxPatient(patient);
    setRxConsultationId(consultationId || null);
    setRxOpen(true);
  };

  // Imaging order overlay, mirroring the lab-order one.
  const [imagingOpen, setImagingOpen] = useState(false);
  const [imagingPatientId, setImagingPatientId] = useState('');

  const openImaging = patientId => {
    setImagingPatientId(patientId || '');
    setImagingOpen(true);
  };

  // Fetch doctor's data
  const { data: appointments = [] } = useQuery({
    queryKey: ['doctor-appointments', user?.id],
    queryFn: () => api.get('/appointments', { params: { doctor_id: user.id, status: 'Scheduled' } }).then(r => r.data.appointments || []),
    enabled: !!user?.id,
  });

  const { data: myPatients = [] } = useQuery({
    queryKey: ['doctor-patients', user?.id],
    queryFn: () => api.get('/clinical/doctors/' + user.id + '/patients').then(r => r.data.patients || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: pendingConsultations = [] } = useQuery({
    queryKey: ['pending-consultations', user?.id],
    queryFn: () => api.get('/clinical/consultations', { params: { doctor_id: user.id, status: 'Draft' } }).then(r => r.data.consultations || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: pendingLabResults = [] } = useQuery({
    queryKey: ['pending-lab-results', user?.id],
    queryFn: () => api.get('/lab/doctor/' + user.id + '/pending').then(r => r.data.results || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: pendingImaging = [] } = useQuery({
    queryKey: ['pending-imaging', user?.id],
    queryFn: () => api.get('/radiology/doctor/' + user.id + '/pending').then(r => r.data.orders || []).catch(() => []),
    enabled: !!user?.id,
  });

  // Backs the Prescriptions tab: consultations this doctor authored, with the
  // prescriptions attached to each.
  const { data: myConsultations = [] } = useQuery({
    queryKey: ['doctor-consultations', user?.id],
    queryFn: () => api.get('/clinical/consultations', { params: { doctor_id: user.id } })
      .then(r => r.data.consultations || []).catch(() => []),
    enabled: !!user?.id,
  });

  // Backs the Referrals tab (requests module: labs/imaging/other requests
  // raised for a patient).
  const { data: referrals = [] } = useQuery({
    queryKey: ['doctor-referrals', user?.id],
    queryFn: () => api.get('/requests').then(r => r.data.requests || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const todayAppointments = appointments.filter(a => 
    format(new Date(a.scheduled_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ) || [];

  const upcomingAppointments = appointments.filter(a => 
    format(new Date(a.scheduled_date), 'yyyy-MM-dd') > format(new Date(), 'yyyy-MM-dd')
  ).slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
          <p className="text-gray-600">Dr. {user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <NotificationBell notifications={notifications} />
          <button
            onClick={() => openOrderLabs()}
            className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <FlaskConical className="w-4 h-4 mr-2" /> Order Labs
          </button>
          <button
            onClick={() => openImaging()}
            className="inline-flex items-center px-3 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700"
          >
            <Activity className="w-4 h-4 mr-2" /> Order Imaging
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{todayAppointments.length}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">My Patients</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{myPatients.length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Consultations</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingConsultations.length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Lab Results</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingLabResults.length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <FlaskConical className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Imaging</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingImaging.length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-pink-100">
              <Activity className="w-6 h-6 text-pink-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <nav className="flex border-b overflow-x-auto" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Appointments */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Today's Appointments</h2>
              <Link to="/appointments" className="text-sm text-blue-600 hover:underline">View All</Link>
            </div>
            <div className="p-6">
              {todayAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No appointments today</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayAppointments.map(appt => (
                    <div key={appt.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{appt.patient_first} {appt.patient_last}</p>
                          <p className="text-sm text-gray-500">{appt.patient_global_id} • {format(new Date(appt.scheduled_date), 'HH:mm')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          appt.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                          appt.status === 'InProgress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {appt.status}
                        </span>
                        <a href={`/clinical/${appt.patient_id}`} className="text-sm text-blue-600 hover:underline">Open</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Alerts */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  // These three open the ordering overlays directly. The rest
                  // are still tab links.
                  { label: 'New Consultation', icon: Stethoscope, color: 'blue', onClick: () => setActiveTab('my-patients') },
                  { label: 'Write Prescription', icon: Pill, color: 'purple', onClick: () => myPatients[0] && openRx(myPatients[0]) },
                  { label: 'Order Lab Tests', icon: FlaskConical, color: 'indigo', onClick: () => openOrderLabs() },
                  { label: 'Order Imaging', icon: Activity, color: 'pink', onClick: () => openImaging() },
                  { label: 'Refer Patient', icon: MessageSquare, color: 'teal', to: '/doctor/referrals' },
                  { label: 'Admit Patient', icon: Heart, color: 'red', to: '/ward' },
                ].map((action, i) => (
                  action.onClick ? (
                    <button
                      key={i}
                      onClick={action.onClick}
                      className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition text-left"
                    >
                      <div className={`p-2 rounded-lg ${getColor(action.color).icon}`}>
                        <action.icon className={`w-5 h-5 ${getColor(action.color).text}`} />
                      </div>
                      <span className="font-medium text-gray-900">{action.label}</span>
                    </button>
                  ) : (
                    <Link key={i} to={action.to} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition text-left">
                      <div className={`p-2 rounded-lg ${getColor(action.color).icon}`}>
                        <action.icon className={`w-5 h-5 ${getColor(action.color).text}`} />
                      </div>
                      <span className="font-medium text-gray-900">{action.label}</span>
                    </Link>
                  )
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notif, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 rounded-full bg-blue-100">
                      <Bell className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                    </div>
                  </div>
                ))}
                {(!notifications || notifications.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No new notifications</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Appointments</h2>
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {appointments.filter(a => 
                    !searchQuery || 
                    `${a.patient_first} ${a.patient_last}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.patient_global_id?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(appt => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{format(new Date(appt.scheduled_date), 'MMM d, yyyy HH:mm')}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{appt.patient_first} {appt.patient_last}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{appt.appointment_type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          appt.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                          appt.status === 'InProgress' ? 'bg-blue-100 text-blue-800' :
                          appt.status === 'Completed' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a href={`/clinical/${appt.patient_id}`} className="text-sm text-blue-600 hover:underline">View Patient</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-patients' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Patients</h2>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age/Gender</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Visit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {myPatients.filter(p => 
                    !searchQuery || 
                    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.global_id?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(patient => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{patient.first_name} {patient.last_name}</p>
                            <p className="text-sm text-gray-500">{patient.global_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {patient.date_of_birth ? Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A'} / {patient.gender}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">Primary</td>
                      <td className="px-6 py-4 text-sm text-gray-500">Recent</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openSoap(patient)}
                            className="text-sm text-blue-600 hover:underline inline-flex items-center"
                          >
                            <Stethoscope className="w-4 h-4 mr-1" /> Start Encounter
                          </button>
                          <button
                            onClick={() => openRx(patient)}
                            className="text-sm text-green-700 hover:underline inline-flex items-center"
                          >
                            <Pill className="w-4 h-4 mr-1" /> Prescribe
                          </button>
                          <button
                            onClick={() => openImaging(patient.id)}
                            className="text-sm text-pink-700 hover:underline inline-flex items-center"
                          >
                            <Activity className="w-4 h-4 mr-1" /> Imaging
                          </button>
                          <a href={`/clinical/${patient.id}`} className="text-sm text-gray-600 hover:underline">
                            Open Chart
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'consultations' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Consultations</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {pendingConsultations.map(consult => (
                <div key={consult.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{consult.chief_complaint}</p>
                      <p className="text-sm text-gray-500">{format(new Date(consult.consultation_date), 'MMM dd, yyyy HH:mm')}</p>
                      {consult.diagnosis && <p className="text-sm text-gray-700 mt-1">Dx: {consult.diagnosis}</p>}
                    </div>
                    <a href={`/clinical/${consult.patient_id}`} className="text-sm text-blue-600 hover:underline">View</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'prescriptions' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Prescriptions</h2>
            <button
              onClick={() => myPatients[0] && openRx(myPatients[0])}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
            >
              <Pill className="w-4 h-4 mr-2" /> New Prescription
            </button>
          </div>
          <div className="p-6">
            {myConsultations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No consultations recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {myConsultations.map(c => (
                  <div key={c.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          {c.patient_first} {c.patient_last}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(c.consultation_date), 'MMM dd, yyyy')} • {c.chief_complaint}
                        </p>
                      </div>
                      <button
                        onClick={() => openRx(
                          { id: c.patient_id, first_name: c.patient_first, last_name: c.patient_last },
                          c.id
                        )}
                        className="text-sm text-green-700 hover:underline"
                      >
                        Prescribe
                      </button>
                    </div>
                    <ConsultationPrescriptions consultationId={c.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'lab-results' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Lab Worklist</h2>
            <button
              onClick={() => openOrderLabs()}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              <FlaskConical className="w-4 h-4 mr-2" /> Order Labs
            </button>
          </div>
          <div className="p-6">
            {pendingLabResults.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending lab work.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Test', 'Patient', 'Status', 'Sample', 'Ordered'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingLabResults.map(t => (
                      <tr key={t.test_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.test_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{t.first_name} {t.last_name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{t.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{t.sample_id || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {t.ordered_at ? format(new Date(t.ordered_at), 'MMM dd') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'imaging' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Imaging Orders</h2>
            <button
              onClick={() => openImaging()}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700"
            >
              <Activity className="w-4 h-4 mr-2" /> Order Imaging
            </button>
          </div>
          <div className="p-6">
            {pendingImaging.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending imaging orders.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Study', 'Patient', 'Indication', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingImaging.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.modality} — {o.body_part}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{o.first_name} {o.last_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{o.clinical_indication || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">{o.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Referrals &amp; Requests</h2>
          </div>
          <div className="p-6">
            {referrals.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No referrals or requests recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Type', 'Patient', 'Details', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {referrals.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.request_type || r.type || 'Request'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {r.patient_first ? `${r.patient_first} ${r.patient_last}` : `#${r.patient_id}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{r.notes || r.description || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <OrderLabsModal
        open={orderLabsOpen}
        onClose={() => setOrderLabsOpen(false)}
        patients={myPatients}
        defaultPatientId={orderLabsPatientId}
      />

      <SoapNoteModal
        open={soapOpen}
        onClose={() => setSoapOpen(false)}
        patient={soapPatient}
        doctorId={user?.id}
        onPrescribe={consultationId => {
          setSoapOpen(false);
          openRx(soapPatient, consultationId);
        }}
      />

      <PrescriptionModal
        open={rxOpen}
        onClose={() => setRxOpen(false)}
        patient={rxPatient}
        consultationId={rxConsultationId}
      />

      <ImagingOrderModal
        open={imagingOpen}
        onClose={() => setImagingOpen(false)}
        patients={myPatients}
        defaultPatientId={imagingPatientId}
      />
    </div>
  );
}