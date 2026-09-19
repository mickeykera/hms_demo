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

export default function DoctorDashboard() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview', { patients: 'my-patients' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch doctor's data
  const { data: appointments } = useQuery({
    queryKey: ['doctor-appointments', user?.id],
    queryFn: () => api.get('/appointments', { params: { doctor_id: user.id, status: 'Scheduled' } }).then(r => r.data.appointments || []),
    enabled: !!user?.id,
  });

  const { data: myPatients } = useQuery({
    queryKey: ['doctor-patients', user?.id],
    queryFn: () => api.get('/clinical/doctors/' + user.id + '/patients').then(r => r.data.patients || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: pendingConsultations } = useQuery({
    queryKey: ['pending-consultations', user?.id],
    queryFn: () => api.get('/clinical/consultations', { params: { doctor_id: user.id, status: 'Pending' } }).then(r => r.data.consultations || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: pendingLabResults } = useQuery({
    queryKey: ['pending-lab-results', user?.id],
    queryFn: () => api.get('/lab/doctor/' + user.id + '/pending').then(r => r.data.results || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: pendingImaging } = useQuery({
    queryKey: ['pending-imaging', user?.id],
    queryFn: () => api.get('/radiology/doctor/' + user.id + '/pending').then(r => r.data.orders || []).catch(() => []),
    enabled: !!user?.id,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const todayAppointments = appointments?.filter(a => 
    format(new Date(a.scheduled_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ) || [];

  const upcomingAppointments = appointments?.filter(a => 
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{myPatients?.length || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingConsultations?.length || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingLabResults?.length || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingImaging?.length || 0}</p>
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
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Today's Appointments</h2>
              <a href="/appointments" className="text-sm text-blue-600 hover:underline">View All</a>
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
                  { label: 'New Consultation', icon: Stethoscope, color: 'blue', action: () => {} },
                  { label: 'Write Prescription', icon: Pill, color: 'purple', action: () => {} },
                  { label: 'Order Lab Tests', icon: FlaskConical, color: 'indigo', action: () => {} },
                  { label: 'Order Imaging', icon: Activity, color: 'pink', action: () => {} },
                  { label: 'Refer Patient', icon: MessageSquare, color: 'teal', action: () => {} },
                  { label: 'Admit Patient', icon: Heart, color: 'red', action: () => {} },
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
              <div className="space-y-3">
                {notifications?.slice(0, 5).map((notif, i) => (
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
          <div className="p-6 border-b flex items-center justify-between">
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
              <table className="w-full">
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
                  {appointments?.filter(a => 
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
          <div className="p-6 border-b flex items-center justify-between">
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
              <table className="w-full">
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
                  {myPatients?.filter(p => 
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
                        <a href={`/clinical/${patient.id}`} className="text-sm text-blue-600 hover:underline">Open Chart</a>
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
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Consultations</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {pendingConsultations?.map(consult => (
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
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Prescriptions</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Prescription management coming soon</p>
          </div>
        </div>
      )}

      {activeTab === 'lab-results' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending Lab Results</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Lab results view coming soon</p>
          </div>
        </div>
      )}

      {activeTab === 'imaging' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Imaging Orders</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Imaging management coming soon</p>
          </div>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Referrals</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-8">Referral management coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}