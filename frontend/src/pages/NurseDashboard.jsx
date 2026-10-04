import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import QueryErrorBanner from '../components/QueryErrorBanner';
import { useAuth } from '../context/AuthContext';
import {
  Users, Heart, Pill, ClipboardList, AlertTriangle, Clock,
  Stethoscope, Activity, Thermometer, Droplet, Weight,
  Bell, MessageSquare, Plus, Eye, Edit, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link , useNavigate } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';
import { useToast } from '../components/Toast';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'my-patients', label: 'My Patients', icon: Users },
  { id: 'vitals', label: 'Vital Signs', icon: Heart },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
  { id: 'orders', label: 'Doctor Orders', icon: Stethoscope },
  { id: 'notes', label: 'Nursing Notes', icon: ClipboardList },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

// Nursing notes: lists recorded notes for the nurse's patients and allows
// adding a new one. Notes are keyed by admission (the ward API requires it).
function NurseNotesTab({ patients }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [admissionId, setAdmissionId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [vitalSigns, setVitalSigns] = useState('');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['nurse-notes', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/tasks')
      .then(r => r.data.tasks || []),
    enabled: !!user?.id,
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/ward/${admissionId}/notes`, {
      note_text: noteText,
      vital_signs: vitalSigns || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurse-notes'] });
      queryClient.invalidateQueries({ queryKey: ['nursing-tasks'] });
      setNoteText('');
      setVitalSigns('');
      toast('Nursing note recorded');
    },
    onError: err => {
      toast(err?.response?.data?.error || 'Failed to record note', 'error');
    },
  });

  const canSave = admissionId && noteText.trim() && !addNote.isPending;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Nursing Notes</h2>
      </div>
      <div className="p-6 space-y-6">
        <form
          onSubmit={e => { e.preventDefault(); if (canSave) addNote.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 space-y-3"
        >
          <div>
            <label htmlFor="note-patient" className="block text-sm font-medium text-gray-700 mb-1">
              Patient / Admission *
            </label>
            <select
              id="note-patient"
              required
              value={admissionId}
              onChange={e => setAdmissionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a patient</option>
              {patients.map(p => (
                <option key={p.admission_id || p.id} value={p.admission_id || ''}>
                  {p.first_name} {p.last_name}
                  {p.ward_name ? ` • ${p.ward_name}` : ''}
                </option>
              ))}
            </select>
            {patients.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No admitted patients assigned to you.</p>
            )}
          </div>
          <div>
            <label htmlFor="note-text" className="block text-sm font-medium text-gray-700 mb-1">
              Observation *
            </label>
            <textarea
              id="note-text"
              rows={3}
              required
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Patient condition, interventions, response…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label htmlFor="note-vitals" className="block text-sm font-medium text-gray-700 mb-1">
                Vitals
              </label>
              <input
                id="note-vitals"
                value={vitalSigns}
                onChange={e => setVitalSigns(e.target.value)}
                placeholder="BP 120/80, HR 72, SpO2 99%"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={!canSave}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addNote.isPending ? 'Saving…' : 'Record Note'}
            </button>
          </div>
        </form>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Notes</h3>
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-gray-500 text-center py-6 text-sm">No nursing notes recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {n.first_name} {n.last_name}
                    </p>
                    <span className="text-xs text-gray-500">
                      {n.note_time ? format(new Date(n.note_time), 'MMM dd, HH:mm') : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{n.note_text}</p>
                  {n.vital_signs && <p className="text-xs text-gray-500 mt-1">Vitals: {n.vital_signs}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NurseDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview', { patients: 'my-patients' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch nurse's data
  const { data: assignedPatients = [], error: assignedPatientsError } = useQuery({
    queryKey: ['nurse-patients', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/patients').then(r => r.data.patients || []),
    enabled: !!user?.id,
  });

  const { data: vitalSigns = [], error: vitalSignsError } = useQuery({
    queryKey: ['vital-signs', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/vitals').then(r => r.data.vitals || []),
    enabled: !!user?.id,
  });

  const { data: medicationSchedule = [], error: medicationScheduleError } = useQuery({
    queryKey: ['medication-schedule', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/medications').then(r => r.data.medications || []),
    enabled: !!user?.id,
  });

  const { data: nursingTasks = [], error: nursingTasksError } = useQuery({
    queryKey: ['nursing-tasks', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/tasks').then(r => r.data.tasks || []),
    enabled: !!user?.id,
  });

  const { data: doctorOrders = [], error: doctorOrdersError } = useQuery({
    queryKey: ['doctor-orders', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/orders').then(r => r.data.orders || []),
    enabled: !!user?.id,
  });

  const { data: notifications = [], error: notificationsError } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const currentShift = 'Day Shift (7AM - 3PM)';

  return (
    <div className="space-y-6">
            {/* A failed load is shown as a failure. Each of these queries
          previously ended in .catch(() => []), so a 500 or a 403 rendered
          as an empty list -- indistinguishable from a clear queue. */}
      <QueryErrorBanner sections={[{ label: 'Assigned patients', error: assignedPatientsError }, { label: 'Vital signs', error: vitalSignsError }, { label: 'Medication schedule', error: medicationScheduleError }, { label: 'Nursing tasks', error: nursingTasksError }, { label: 'Doctor orders', error: doctorOrdersError }, { label: 'Notifications', error: notificationsError }]}
        onRetry={() => queryClient.invalidateQueries()} />
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nurse Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {currentShift} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <NotificationBell notifications={notifications} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Assigned Patients</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{assignedPatients.length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vitals Due</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{vitalSigns.filter(v => v.due).length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Meds Due Now</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{medicationSchedule.filter(m => m.due_now).length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <Pill className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{nursingTasks.filter(t => !t.completed).length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <ClipboardList className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Doctor Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{doctorOrders.filter(o => o.status === 'Pending').length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Stethoscope className="w-6 h-6 text-blue-600" />
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assigned Patients */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Assigned Patients</h2>
            </div>
            <div className="p-6">
              {assignedPatients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No assigned patients</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignedPatients.map(patient => (
                    <div key={patient.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                          <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{patient.first_name} {patient.last_name}</p>
                          <p className="text-sm text-gray-500">{patient.global_id} • Bed: {patient.bed_number} • {patient.ward_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${patient.critical ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {patient.critical ? 'Critical' : 'Stable'}
                        </span>
                        <a href={`/ward/patient/${patient.id}`} className="text-sm text-blue-600 hover:underline">View</a>
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
                  { label: 'Record Vitals', icon: Heart, color: 'red', to: '/nurse/vitals' },
                  { label: 'Give Medication', icon: Pill, color: 'purple', to: '/nurse/medications' },
                  { label: 'Add Nursing Note', icon: ClipboardList, color: 'blue', to: '/nurse/notes' },
                  { label: 'Intake/Output', icon: Droplet, color: 'cyan', to: '/nurse/tasks' },
                  { label: 'Call Doctor', icon: MessageSquare, color: 'orange', to: '/nurse/orders' },
                  { label: 'Request Assistance', icon: AlertTriangle, color: 'yellow', to: '/nurse/tasks' },
                ].map((action, i) => (
                  <Link key={i} to={action.to} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition text-left">
                    <div className={`p-2 rounded-lg ${getColor(action.color).icon}`}>
                      <action.icon className={`w-5 h-5 ${getColor(action.color).text}`} />
                    </div>
                    <span className="font-medium text-gray-900">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts</h2>
              <div className="space-y-3">
                {[
                  { type: 'warning', message: 'Patient in Bed G-102: Temp 39.2°C', time: '5 min ago' },
                  { type: 'info', message: 'Medication due for Patient in Bed G-101', time: '15 min ago' },
                  { type: 'warning', message: 'Doctor order pending for Patient in Bed ICU-01', time: '30 min ago' },
                ].map((alert, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-full ${alert.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                      {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                      {alert.type === 'info' && <Clock className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-patients' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Assigned Patients</h2>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diagnosis</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignedPatients.filter(p => 
                    !searchQuery || 
                    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.global_id?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(patient => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{patient.first_name} {patient.last_name}</p>
                            <p className="text-sm text-gray-500">{patient.global_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{patient.bed_number} ({patient.ward_name})</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{format(new Date(patient.admission_date), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{patient.diagnosis || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${patient.critical ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {patient.critical ? 'Critical' : 'Stable'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a href={`/ward/patient/${patient.id}`} className="text-sm text-blue-600 hover:underline">View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vitals' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Vital Signs Due</h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BP</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SpO2</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vitalSigns.map(vital => (
                    <tr key={vital.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium">{vital.patient_name}</p>
                        <p className="text-sm text-gray-500">{vital.global_id} • {vital.bed}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">{vital.temperature || '-'}</td>
                      <td className="px-6 py-4 text-sm">{vital.blood_pressure || '-'}</td>
                      <td className="px-6 py-4 text-sm">{vital.heart_rate || '-'}</td>
                      <td className="px-6 py-4 text-sm">{vital.respiratory_rate || '-'}</td>
                      <td className="px-6 py-4 text-sm">{vital.oxygen_saturation || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{vital.due_at ? format(new Date(vital.due_at), 'HH:mm') : 'N/A'}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => navigate('/nurse/vitals')} className="text-sm text-blue-600 hover:underline">Record</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b">
            <h2 className="text-lg font-semibold">Medication Administration</h2>
          </div>
          <div className="p-6">
            {medicationSchedule.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No medications due for your patients.</p>
            ) : (
              <div className="space-y-3">
                {medicationSchedule.map(m => (
                  <div key={m.id} className="p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Pill className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">{m.medication_name}</p>
                        <p className="text-sm text-gray-600">
                          {m.dosage} • {m.frequency}
                          {m.duration_days ? ` • ${m.duration_days} days` : ''}
                        </p>
                        {m.instructions && <p className="text-xs text-gray-500 mt-1">{m.instructions}</p>}
                        {m.first_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            {m.first_name} {m.last_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="self-start sm:self-auto px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b">
            <h2 className="text-lg font-semibold">Nursing Tasks</h2>
          </div>
          <div className="p-6">
            {nursingTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No tasks recorded for your ward.</p>
            ) : (
              <div className="space-y-3">
                {nursingTasks.map(t => (
                  <div key={t.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900">
                        {t.first_name} {t.last_name}
                      </p>
                      <span className="text-xs text-gray-500">
                        {t.note_time ? format(new Date(t.note_time), 'MMM dd, HH:mm') : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{t.note_text}</p>
                    {t.vital_signs && (
                      <p className="text-xs text-gray-500 mt-1">Vitals: {t.vital_signs}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b">
            <h2 className="text-lg font-semibold">Doctor Orders</h2>
          </div>
          <div className="p-6">
            {doctorOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No outstanding orders for your patients.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Order', 'Patient', 'Status', 'Ordered'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {doctorOrders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.test_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {o.first_name} {o.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{o.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {o.ordered_at ? format(new Date(o.ordered_at), 'MMM dd') : '—'}
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

      {activeTab === 'notes' && (
        <NurseNotesTab patients={assignedPatients} />
      )}
    </div>
  );
}