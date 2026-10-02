import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Calendar, ClipboardList, AlertTriangle, Clock, CheckCircle,
  Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  FileText, UserPlus, UserCheck, UserX, Phone, Mail,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link , useNavigate } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'registration', label: 'Registration', icon: UserPlus },
  { id: 'checkin', label: 'Check-In', icon: UserCheck },
  { id: 'queue', label: 'Queue', icon: ClipboardList },
  { id: 'patients', label: 'Patients', icon: Users },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

export default function ReceptionDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  // Real status transitions via the API; the backend validates the move.
  const setApptStatus = async (appt, status, verb) => {
    setBusyId(appt.id);
    setActionMsg(null);
    try {
      await api.put(`/appointments/${appt.id}/status`, { status });
      setActionMsg(`${verb} succeeded for ${appt.patient_first} ${appt.patient_last}.`);
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
    } catch (e) {
      setActionMsg(e.response?.data?.error || `${verb} failed.`);
    } finally {
      setBusyId(null);
    }
  };

  // ---- Registration form state ----
  const emptyRegForm = {
    first_name: '', last_name: '', date_of_birth: '', gender: '', phone: '',
    email: '', address: '', blood_type: '', emergency_contact_name: '',
    emergency_contact_phone: '', insurance_provider: '', insurance_id: '',
  };
  const [regForm, setRegForm] = useState(emptyRegForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [registeredId, setRegisteredId] = useState(null);

  const onRegChange = (e) => {
    const { name, value } = e.target;
    setRegForm((f) => ({ ...f, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setRegisteredId(null);
    try {
      const res = await api.post('/reception/register', regForm);
      setRegisteredId(res.data.global_id);
      setRegForm(emptyRegForm);
      queryClient.invalidateQueries();
    } catch (err) {
      const d = err.response?.data;
      // The backend validates with zod; surface the first field error.
      setFormError(d?.error
        || d?.details?.[0]?.message
        || (Array.isArray(d?.errors) ? d.errors[0]?.message : null)
        || 'Could not register the patient.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Check-in form state ----
  const [checkinQuery, setCheckinQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [checkinVisitType, setCheckinVisitType] = useState('WalkIn');
  const [checkinPriority, setCheckinPriority] = useState('3');
  const [checkinDept, setCheckinDept] = useState('General');
  const [checkinError, setCheckinError] = useState(null);
  const [checkedIn, setCheckedIn] = useState(null);

  // ---- Patient search (Patients tab) ----
  const [patientResults, setPatientResults] = useState([]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setPatientResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/reception/search', { params: { q } });
        if (!cancelled) setPatientResults(res.data.patients || []);
      } catch {
        if (!cancelled) setPatientResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Debounced patient lookup so typing an identifier finds the record.
  useEffect(() => {
    const q = checkinQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSelectedPatient(null);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/reception/search', { params: { q } });
        if (!cancelled) {
          setSearchResults(res.data.patients || []);
          // Allow checking in by typing an exact Global ID.
          const exact = (res.data.patients || []).find(
            (p) => p.global_id.toLowerCase() === q.toLowerCase()
          );
          if (exact) setSelectedPatient(exact);
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checkinQuery]);

  const handleCheckin = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      setCheckinError('Select or match a patient before checking in.');
      return;
    }
    setSaving(true);
    setCheckinError(null);
    setCheckedIn(null);
    try {
      const res = await api.post(
        `/reception/${selectedPatient.global_id}/checkin`,
        {
          triage_priority: Number(checkinPriority),
          visit_type: checkinVisitType,
          department: checkinDept,
        }
      );
      setCheckedIn(res.data);
      setCheckinQuery('');
      setSelectedPatient(null);
      queryClient.invalidateQueries();
    } catch (err) {
      setCheckinError(err.response?.data?.error || 'Could not check the patient in.');
    } finally {
      setSaving(false);
    }
  };

  const { data: todayAppointments = [], isLoading: loadingAppointments, isError: appointmentsError } = useQuery({
    queryKey: ['today-appointments'],
    queryFn: () => api.get('/appointments', { params: { date: format(new Date(), 'yyyy-MM-dd') } }).then(r => r.data.appointments || []),
    refetchInterval: 30000,
  });

  const { data: waitingPatients = [], isLoading: loadingQueue, isError: queueError } = useQuery({
    queryKey: ['waiting-patients'],
    queryFn: () => api.get('/reception/queue/General').then(r => r.data.waiting_patients || []),
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const stats = {
    todayAppointments: todayAppointments.length,
    checkedIn: todayAppointments.filter(a => a.status === 'InProgress' || a.status === 'Completed').length || 0,
    waiting: waitingPatients.length,
    noShows: todayAppointments.filter(a => a.status === 'NoShow').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reception Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <NotificationBell notifications={notifications} />
        </div>
      </div>

      {/* Surface fetch failures instead of silently showing all-zero stats. */}
      {(appointmentsError || queueError) && (
        <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            Some data could not be loaded
            {appointmentsError && ' (appointments)'}
            {queueError && ' (waiting queue)'}
            . The figures below may be incomplete.
          </span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Checked In</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.checkedIn}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Waiting Patients</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.waiting}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">No-Shows</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.noShows}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <UserX className="w-6 h-6 text-red-600" />
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
              {tab.id === 'queue' && stats.waiting > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">{stats.waiting}</span>
              )}
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
              {!loadingAppointments && todayAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No appointments today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.slice(0, 10).map(appt => (
                    <div key={appt.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{appt.patient_first} {appt.patient_last}</p>
                          <p className="text-sm text-gray-500">{format(new Date(appt.scheduled_date), 'HH:mm')} • Dr. {appt.doctor_first} {appt.doctor_last} • {appt.appointment_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${appt.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' : appt.status === 'Confirmed' ? 'bg-green-100 text-green-800' : appt.status === 'InProgress' ? 'bg-blue-100 text-blue-800' : appt.status === 'Completed' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                          {appt.status}
                        </span>
                        <button onClick={() => setApptStatus(appt, 'Confirmed', 'Check-in')} disabled={busyId === appt.id} className="text-sm text-blue-600 hover:underline disabled:opacity-50">{busyId === appt.id ? 'Working...' : 'Check-In'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Register New Patient', icon: UserPlus, color: 'blue', to: '/reception/registration' },
                  { label: 'Schedule Appointment', icon: Calendar, color: 'green', to: '/reception/appointments' },
                  { label: 'Walk-In Check-In', icon: UserCheck, color: 'purple', to: '/reception/checkin' },
                  { label: 'Search Patient', icon: Search, color: 'orange', to: '/reception/patients' },
                  { label: 'Print Queue', icon: FileText, color: 'indigo', to: '/reception/queue' },
                  { label: 'Manage Cancellations', icon: UserX, color: 'red', to: '/reception/appointments' },
                ].map((action, i) => (
                  <Link key={i} to={action.to} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
                    <div className={`p-2 rounded-lg ${getColor(action.color).icon}`}>
                      <action.icon className={`w-5 h-5 ${getColor(action.color).text}`} />
                    </div>
                    <span className="font-medium text-gray-900">{action.label}</span>
                  </Link>
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
                {notifications.length === 0 && (
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
            <div className="flex gap-3">
              <input
                type="date"
                value={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => {}}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayAppointments.filter(a =>
                    !searchQuery ||
                    `${a.patient_first} ${a.patient_last}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    `${a.doctor_first} ${a.doctor_last}`.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(appt => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{format(new Date(appt.scheduled_date), 'HH:mm')}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{appt.patient_first} {appt.patient_last}</p>
                        <p className="text-sm text-gray-500">{appt.patient_global_id}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">Dr. {appt.doctor_first} {appt.doctor_last}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{appt.appointment_type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${appt.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' : appt.status === 'Confirmed' ? 'bg-green-100 text-green-800' : appt.status === 'InProgress' ? 'bg-blue-100 text-blue-800' : appt.status === 'Completed' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setApptStatus(appt, 'Confirmed', 'Check-in')} disabled={busyId === appt.id} className="text-sm text-blue-600 hover:underline disabled:opacity-50">{busyId === appt.id ? 'Working...' : 'Check-In'}</button>
                          <button onClick={() => setApptStatus(appt, 'Scheduled', 'Reschedule')} disabled={busyId === appt.id} className="text-sm text-gray-600 hover:underline disabled:opacity-50">Reschedule</button>
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

      {activeTab === 'registration' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-6">Register New Patient</h2>
          <form onSubmit={handleRegister} className="max-w-2xl space-y-6">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">{formError}</div>
            )}
            {registeredId && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800" role="status">
                Registered <strong>{registeredId}</strong> — the patient is now in the system.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="reg_first" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input id="reg_first" name="first_name" type="text" value={regForm.first_name} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label htmlFor="reg_last" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input id="reg_last" name="last_name" type="text" value={regForm.last_name} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label htmlFor="reg_dob" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input id="reg_dob" name="date_of_birth" type="date" value={regForm.date_of_birth} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label htmlFor="reg_gender" className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <select id="reg_gender" name="gender" value={regForm.gender} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="PreferNotToSay">Prefer Not To Say</option>
                </select>
              </div>
              <div>
                <label htmlFor="reg_phone" className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input id="reg_phone" name="phone" type="tel" value={regForm.phone} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label htmlFor="reg_email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input id="reg_email" name="email" type="email" value={regForm.email} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="reg_address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea id="reg_address" name="address" value={regForm.address} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div>
                <label htmlFor="reg_blood" className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                <select id="reg_blood" name="blood_type" value={regForm.blood_type} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="reg_ecname" className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                <input id="reg_ecname" name="emergency_contact_name" type="text" value={regForm.emergency_contact_name} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="reg_ecphone" className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                <input id="reg_ecphone" name="emergency_contact_phone" type="tel" value={regForm.emergency_contact_phone} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="reg_insprov" className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                <input id="reg_insprov" name="insurance_provider" type="text" value={regForm.insurance_provider} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="reg_insid" className="block text-sm font-medium text-gray-700 mb-1">Insurance ID</label>
                <input id="reg_insid" name="insurance_id" type="text" value={regForm.insurance_id} onChange={onRegChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <button onClick={() => setActiveTab('overview')} type="button" className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Registering...' : 'Register Patient'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'checkin' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-6">Patient Check-In</h2>
          <form onSubmit={handleCheckin} className="max-w-md space-y-6">
            {checkinError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">{checkinError}</div>
            )}
            {checkedIn && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800" role="status">
                Checked in — queue position <strong>#{checkedIn.queue_position}</strong>.
              </div>
            )}
            <div>
              <label htmlFor="ci_query" className="block text-sm font-medium text-gray-700 mb-1">Patient Global ID / Phone / Name *</label>
              <input id="ci_query" type="text" value={checkinQuery} onChange={e => setCheckinQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter patient identifier" required />
            </div>

            {checkinQuery.trim().length > 1 && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
                {searching ? (
                  <p className="p-3 text-sm text-gray-500">Searching...</p>
                ) : searchResults.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">No patients match that search.</p>
                ) : (
                  searchResults.map(p => (
                    <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setCheckinQuery(p.global_id); }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition ${selectedPatient?.id === p.id ? 'bg-blue-50' : ''}`}>
                      <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-500">{p.global_id} · {p.phone}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            <div>
              <label htmlFor="ci_visit" className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
              <select id="ci_visit" value={checkinVisitType} onChange={e => setCheckinVisitType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="WalkIn">Walk-In</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Emergency">Emergency</option>
                <option value="FollowUp">Follow-Up</option>
              </select>
            </div>
            <div>
              <label htmlFor="ci_priority" className="block text-sm font-medium text-gray-700 mb-1">Triage Priority</label>
              <select id="ci_priority" value={checkinPriority} onChange={e => setCheckinPriority(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="3">3 - Standard</option>
                <option value="1">1 - Critical</option>
                <option value="2">2 - Urgent</option>
                <option value="4">4 - Low</option>
                <option value="5">5 - Non-urgent</option>
              </select>
            </div>
            <div>
              <label htmlFor="ci_dept" className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select id="ci_dept" value={checkinDept} onChange={e => setCheckinDept(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                {['General','Emergency','Cardiology','Pediatrics','Surgery'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <button onClick={() => setActiveTab('overview')} type="button" className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving || !selectedPatient} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Checking in...' : 'Check In Patient'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Waiting Queue - General</h2>
            <select className="px-4 py-2 border rounded-lg">
              <option value="General">General</option>
              <option value="Emergency">Emergency</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Surgery">Surgery</option>
            </select>
          </div>
          <div className="p-6">
            {!loadingQueue && waitingPatients.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-600">No patients waiting</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitingPatients.map(patient => (
                  <div key={patient.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                        {patient.queue_position}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{patient.first_name} {patient.last_name}</p>
                        <p className="text-sm text-gray-500">{patient.global_id} • {patient.visit_type} • Priority {patient.triage_priority}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${patient.triage_priority <= 2 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        Priority {patient.triage_priority}
                      </span>
                      <button onClick={() => navigate('/reception/patients')} className="text-sm text-blue-600 hover:underline">Call</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-6">Patient Search</h2>
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, phone, email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>
          </div>
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600">Enter search criteria to find patients</p>
          </div>
        </div>
      )}
    </div>
  );
}