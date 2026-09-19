import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Building2, Shield, FileText, BarChart2, Settings,
  Bell, Search, Eye, Edit, Plus, Trash2, AlertTriangle,
  DollarSign, Stethoscope, Pill, Activity, Heart, Bed,
  Key, Lock, Unlock, LogOut, UserPlus, UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'personnel', label: 'Personnel', icon: UserCheck },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'patients', label: 'Patients', icon: Heart },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview', { department: 'overview', new: 'users' });

  const { data: systemStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data).catch(() => ({})),
  });

  const { data: recentUsers } = useQuery({
    queryKey: ['recent-users'],
    queryFn: () => api.get('/personnel', { params: { limit: 10 } }).then(r => r.data.personnel || []).catch(() => []),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/audit-logs', { params: { limit: 20 } }).then(r => r.data.logs || []).catch(() => []),
  });

  const stats = {
    totalUsers: systemStats?.total_users || 0,
    activeUsers: systemStats?.active_users || 0,
    totalPatients: systemStats?.total_patients || 0,
    todayAppointments: systemStats?.today_appointments || 0,
    occupancyRate: systemStats?.occupancy_rate || 0,
    revenue: systemStats?.revenue_today || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <button className="relative p-2 text-gray-600 hover:text-gray-900">
            <Bell className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
            </div>
            <div className="p-3 rounded-full bg-indigo-100">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.activeUsers}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Patients</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalPatients}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Heart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <Stethoscope className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bed Occupancy</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.occupancyRate}%</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Bed className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
              <p className="text-3xl font-bold text-green-600 mt-1">${stats.revenue?.toLocaleString() || '0'}</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-100">
              <DollarSign className="w-6 h-6 text-emerald-600" />
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {auditLogs?.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 rounded-full bg-indigo-100">
                      <Shield className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{log.action} on {log.resource_type}</p>
                      <p className="text-xs text-gray-500 mt-1">By user {log.actor_id} • {format(new Date(log.created_at), 'MMM d, HH:mm')}</p>
                      {log.details && <p className="text-xs text-gray-400 mt-1">{log.details}</p>}
                    </div>
                  </div>
                ))}
                {(!auditLogs || auditLogs.length === 0) && (
                  <p className="text-gray-500 text-center py-8">No recent activity</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Create User', icon: UserPlus, color: 'blue', href: '/admin/users/new' },
                  { label: 'Manage Roles', icon: Shield, color: 'purple', href: '/admin/roles' },
                  { label: 'Manage Departments', icon: Building2, color: 'green', href: '/admin/departments' },
                  { label: 'View Audit Logs', icon: FileText, color: 'orange', href: '/admin/audit' },
                  { label: 'System Settings', icon: Settings, color: 'gray', href: '/admin/settings' },
                  { label: 'Generate Report', icon: BarChart2, color: 'teal', href: '/admin/reports' },
                ].map((action, i) => (
                  <a key={i} href={action.href} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
                    <div className={`p-2 rounded-lg bg-${action.color}-100`}>
                      <action.icon className={`w-5 h-5 text-${action.color}-600`} />
                    </div>
                    <span className="font-medium text-gray-900">{action.label}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">System Alerts</h2>
              <div className="space-y-3">
                {[
                  { type: 'warning', message: '3 users have not logged in for 30+ days', time: '1 hour ago' },
                  { type: 'info', message: 'Database backup completed successfully', time: '2 hours ago' },
                  { type: 'success', message: 'All systems operational', time: '5 hours ago' },
                ].map((alert, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-full ${alert.type === 'warning' ? 'bg-yellow-100' : alert.type === 'success' ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                      {alert.type === 'success' && <UserCheck className="w-5 h-5 text-green-600" />}
                      {alert.type === 'info' && <Bell className="w-5 h-5 text-blue-600" />}
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

      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">User Management</h2>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search users..."
                className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <a href="/admin/users/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Add User
              </a>
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentUsers?.map(personnel => (
                    <tr key={personnel.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{personnel.user_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{personnel.first_name} {personnel.last_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{personnel.role_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{personnel.department_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${personnel.employment_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {personnel.employment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Recent</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="text-sm text-indigo-600 hover:underline">Edit</button>
                          <button className="text-sm text-gray-600 hover:underline">Disable</button>
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

      {activeTab === 'personnel' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Personnel management coming soon</p>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Roles & permissions management coming soon</p>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Department management coming soon</p>
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Patient administration coming soon</p>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Audit Logs</h2>
            <input
              type="text"
              placeholder="Search logs..."
              className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditLogs?.map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">User {log.actor_id}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.action}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{log.resource_type} #{log.resource_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{log.details || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Reports & analytics coming soon</p>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">System settings coming soon</p>
        </div>
      )}
    </div>
  );
}