import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Heart, Pill, ClipboardList, AlertTriangle, Clock,
  Stethoscope, Activity, Thermometer, Droplet, Weight,
  Bell, MessageSquare, Plus, Eye, Edit, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

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

export default function NurseDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview', { patients: 'my-patients' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch nurse's data
  const { data: assignedPatients } = useQuery({
    queryKey: ['nurse-patients', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/patients').then(r => r.data.patients || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: vitalSigns } = useQuery({
    queryKey: ['vital-signs', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/vitals').then(r => r.data.vitals || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: medicationSchedule } = useQuery({
    queryKey: ['medication-schedule', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/medications').then(r => r.data.medications || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: nursingTasks } = useQuery({
    queryKey: ['nursing-tasks', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/tasks').then(r => r.data.tasks || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: doctorOrders } = useQuery({
    queryKey: ['doctor-orders', user?.id],
    queryFn: () => api.get('/ward/nurse/' + user.id + '/orders').then(r => r.data.orders || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const currentShift = 'Day Shift (7AM - 3PM)';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nurse Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {currentShift} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <button className="relative p-2 text-gray-600 hover:text-gray-900">
            <Bell className="w-6 h-6" />
            {notifications?.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Assigned Patients</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{assignedPatients?.length || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{vitalSigns?.filter(v => v.due).length || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{medicationSchedule?.filter(m => m.due_now).length || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{nursingTasks?.filter(t => !t.completed).length || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{doctorOrders?.filter(o => o.status === 'Pending').length || 0}</p>
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
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Assigned Patients</h2>
            </div>
            <div className="p-6">
              {assignedPatients?.length === 0 ? (
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
                  { label: 'Record Vitals', icon: Heart, color: 'red' },
                  { label: 'Give Medication', icon: Pill, color: 'purple' },
                  { label: 'Add Nursing Note', icon: ClipboardList, color: 'blue' },
                  { label: 'Intake/Output', icon: Droplet, color: 'cyan' },
                  { label: 'Call Doctor', icon: MessageSquare, color: 'orange' },
                  { label: 'Request Assistance', icon: AlertTriangle, color: 'yellow' },
                ].map((action, i) => (
                  <button key={i} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition text-left">
                    <div className={`p-2 rounded-lg bg-${action.color}-100`}>
                      <action.icon className={`w-5 h-5 text-${action.color}-600`} />
                    </div>
                    <span className="font-medium text-gray-900">{action.label}</span>
                  </button>
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
          <div className="p-6 border-b flex items-center justify-between">
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
              <table className="w-full">
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
                  {assignedPatients?.filter(p => 
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
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Vital Signs Due</h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
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
                  {vitalSigns?.map(vital => (
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
                        <button className="text-sm text-blue-600 hover:underline">Record</button>
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
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Medication Administration</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Medication administration coming soon</p>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nursing Tasks</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Task management coming soon</p>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Doctor Orders</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Doctor orders view coming soon</p>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nursing Notes</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Nursing notes coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}