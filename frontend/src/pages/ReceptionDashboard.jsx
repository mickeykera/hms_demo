import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Calendar, ClipboardList, AlertTriangle, Clock, CheckCircle,
  Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  FileText, UserPlus, UserCheck, UserX, Phone, Mail,
} from 'lucide-react';
import { format } from 'date-fns';

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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: todayAppointments } = useQuery({
    queryKey: ['today-appointments'],
    queryFn: () => api.get('/appointments', { params: { date: format(new Date(), 'yyyy-MM-dd') } }).then(r => r.data.appointments || []),
    refetchInterval: 30000,
  });

  const { data: waitingPatients } = useQuery({
    queryKey: ['waiting-patients'],
    queryFn: () => api.get('/reception/queue/General').then(r => r.data.waiting_patients || []),
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const stats = {
    todayAppointments: todayAppointments?.length || 0,
    checkedIn: todayAppointments?.filter(a => a.status === 'InProgress' || a.status === 'Completed').length || 0,
    waiting: waitingPatients?.length || 0,
    noShows: todayAppointments?.filter(a => a.status === 'NoShow').length || 0,
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
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Today's Appointments</h2>
              <a href="/appointments" className="text-sm text-blue-600 hover:underline">View All</a>
            </div>
            <div className="p-6">
              {todayAppointments?.length === 0 ? (
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
                        <button className="text-sm text-blue-600 hover:underline">Check-In</button>
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
                  { label: 'Register New Patient', icon: UserPlus, color: 'blue', href: '/reception' },
                  { label: 'Schedule Appointment', icon: Calendar, color: 'green', href: '/appointments' },
                  { label: 'Walk-In Check-In', icon: UserCheck, color: 'purple', href: '/reception' },
                  { label: 'Search Patient', icon: Search, color: 'orange', href: '/reception' },
                  { label: 'Print Queue', icon: FileText, color: 'indigo', action: () => {} },
                  { label: 'Manage Cancellations', icon: UserX, color: 'red', href: '/appointments' },
                ].map((action, i) => (
                  <a key={i} href={action.href || '#'} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
                    <div className={`p-2 rounded-lg bg-${action.color}-100`}>
                      <action.icon className={`w-5 h-5 text-${action.color}-600`} />
                    </div>
                    <span className="font-medium text-gray-900">{action.label}</span>
                  </a>
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
              <table className="w-full">
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
                  {todayAppointments?.filter(a => 
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
                          <button className="text-sm text-blue-600 hover:underline">Check-In</button>
                          <button className="text-sm text-gray-600 hover:underline">Reschedule</button>
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
          <form className="max-w-2xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input type="date" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="PreferNotToSay">Prefer Not To Say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                <input type="tel" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance ID</label>
                <input type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Register Patient</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'checkin' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-6">Patient Check-In</h2>
          <form className="max-w-md space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Global ID / Phone / Name *</label>
              <input type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter patient identifier" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="WalkIn">Walk-In</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Emergency">Emergency</option>
                <option value="FollowUp">Follow-Up</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Triage Priority</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="3">3 - Standard</option>
                <option value="1">1 - Critical</option>
                <option value="2">2 - Urgent</option>
                <option value="4">4 - Low</option>
                <option value="5">5 - Non-Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="General">General</option>
                <option value="Emergency">Emergency</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="Surgery">Surgery</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Check In Patient</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
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
            {waitingPatients?.length === 0 ? (
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
                      <button className="text-sm text-blue-600 hover:underline">Call</button>
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