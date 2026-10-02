import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Building2, Shield, FileText, BarChart2, Settings,
  Bell, Search, Eye, Edit, Plus, Trash2, AlertTriangle,
  DollarSign, Stethoscope, Pill, Activity, Heart, Bed,
  Key, Lock, Unlock, LogOut, UserPlus, UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';
import { useToast } from '../components/Toast';

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

// ---------- Admin tabs ----------
// Personnel/roles/departments/patients/settings each read an endpoint that
// already existed; only "System settings" needed a new route.
function AdminPersonnelTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const { data: personnel = [] } = useQuery({
    queryKey: ['admin-personnel'],
    queryFn: () => api.get('/personnel').then(r => r.data.personnel || []).catch(() => []),
    enabled: !!user?.id,
  });
  const rows = personnel.filter(p =>
    !search || `${p.first_name} ${p.last_name} ${p.employee_id} ${p.professional_title || ''}`
      .toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Personnel Management</h2>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search personnel..." aria-label="Search personnel"
          className="w-full sm:w-64 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="p-6">
        {rows.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No personnel records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Employee ID', 'Title', 'Status', 'Hired'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.employee_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.professional_title || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.employment_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {p.employment_status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p.hire_date ? format(new Date(p.hire_date), 'MMM dd, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminRolesTab() {
  const { user } = useAuth();
  const [roleName, setRoleName] = useState('');
  const { data: roles = [] } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => api.get('/rbac/roles').then(r => r.data.roles || []).catch(() => []),
    enabled: !!user?.id,
  });
  const { data: permissions = [] } = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: () => api.get('/rbac/permissions').then(r => r.data.permissions || []).catch(() => []),
    enabled: !!user?.id,
  });
  const [selected, setSelected] = useState('');
  const active = roles.find(r => String(r.id) === String(selected));
  const granted = new Set(
    (permissions.filter(p => p.role_id === Number(selected))).map(p => p.permission_id)
  );
  const fld = 'px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Roles &amp; Permissions</h2>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="rb-role" className="block text-sm font-medium text-gray-700 mb-1">Select role</label>
            <input id="rb-role" value={roleName} onChange={e => setRoleName(e.target.value)}
              placeholder="Filter roles..." className={fld} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Roles ({roles.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {roles.filter(r => !roleName || r.name?.toLowerCase().includes(roleName.toLowerCase())).map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelected(String(r.id))}
                  className={`w-full text-left p-3 border rounded-lg text-sm ${
                    String(r.id) === selected ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium text-gray-900">{r.name}</span>
                  {r.description && <span className="block text-xs text-gray-500">{r.description}</span>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Permissions {active ? `for ${active.name}` : '(select a role)'}
            </h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {permissions.length === 0 && <p className="text-sm text-gray-500">No permissions defined.</p>}
              {permissions.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span className="text-gray-700">{p.name || p.code}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selected ? (granted.has(p.id) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500')
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selected ? (granted.has(p.id) ? 'Granted' : 'Not granted') : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDepartmentsTab() {
  const { user } = useAuth();
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => api.get('/departments').then(r => r.data.departments || []).catch(() => []),
    enabled: !!user?.id,
  });
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Department Management</h2>
      </div>
      <div className="p-6">
        {departments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No departments configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Department', 'Code', 'Manager', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departments.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.code || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{d.manager_name || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        d.active === false ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'
                      }`}>
                        {d.active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPatientsTab() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const { data: results = [] } = useQuery({
    queryKey: ['admin-patients', q],
    queryFn: () => api.get('/reception/search', { params: { q } })
      .then(r => r.data.patients || r.data.results || []).catch(() => []),
    enabled: !!user?.id && q.length >= 2,
  });
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Patient Administration</h2>
        <input
          type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search by name, ID or phone..." aria-label="Search patients"
          className="w-full sm:w-72 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="p-6">
        {q.length < 2 ? (
          <p className="text-gray-500 text-center py-8">Type at least 2 characters to search.</p>
        ) : results.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No patients matched.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Patient', 'Global ID', 'Gender', 'Blood', 'Phone'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.global_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.gender || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.blood_type || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminReportsTab() {
  const { user } = useAuth();
  // Fetched here rather than reused from the page component: tabs are separate
  // functions and cannot close over the parent's query result.
  const { data: systemStats = {} } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });
  const { data: stats } = useQuery({
    queryKey: ['admin-audit-stats'],
    queryFn: () => api.get('/audit/stats').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });
  const tiles = [
    { label: 'Total Patients', value: systemStats?.total_patients },
    { label: 'Total Users', value: systemStats?.total_users },
    { label: 'Active Personnel', value: systemStats?.active_personnel },
    { label: 'Departments', value: systemStats?.total_departments },
    { label: 'Total Visits', value: systemStats?.total_visits },
    { label: 'Revenue (billed)', value: stats?.total_revenue },
  ];
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Reports &amp; Analytics</h2>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map(t => (
            <div key={t.label} className="p-4 border rounded-lg">
              <p className="text-xs text-gray-500 uppercase">{t.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {t.value === undefined || t.value === null ? '—' : Number(t.value).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        {stats?.by_action && stats.by_action.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Audit activity by action</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead className="bg-gray-50">
                  <tr>
                    {['Action', 'Count'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.by_action.map(a => (
                    <tr key={a.action}>
                      <td className="px-4 py-3 text-sm text-gray-900">{a.action}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{a.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminSettingsTab() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});

  const { data: settings = [] } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data.settings || []).catch(() => []),
    enabled: !!user?.id,
  });

  const save = useMutation({
    mutationFn: ({ key, value }) => api.put(`/admin/settings/${key}`, {
      value, category: settings.find(s => s.key === key)?.category,
    }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setDrafts(d => ({ ...d, [vars.key]: '' }));
      toast(`Saved ${vars.key}`);
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to save setting', 'error'),
  });

  const canWrite = user?.role === 'SuperAdmin';
  const fld = 'px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">System Settings</h2>
        {!canWrite && (
          <p className="text-xs text-gray-500 mt-1">Read-only — only SuperAdmin can change these values.</p>
        )}
      </div>
      <div className="p-6">
        {settings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No settings defined.</p>
        ) : (
          <div className="space-y-3">
            {settings.map(s => {
              const draft = drafts[s.key];
              const value = draft !== undefined ? draft : (s.value ?? '');
              return (
                <div key={s.key} className="flex flex-col sm:flex-row sm:items-end gap-2">
                  <div className="sm:w-48">
                    <label htmlFor={`set-${s.key}`} className="block text-sm font-medium text-gray-700">
                      {s.key.replace(/_/g, ' ')}
                    </label>
                    <span className="text-xs text-gray-500">{s.category}</span>
                  </div>
                  <input
                    id={`set-${s.key}`} value={value} disabled={!canWrite} className={fld}
                    onChange={e => setDrafts(d => ({ ...d, [s.key]: e.target.value }))}
                  />
                  {canWrite && (
                    <button
                      onClick={() => save.mutate({ key: s.key, value })}
                      disabled={save.isPending || draft === undefined || draft === s.value}
                      className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {save.isPending ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview', { department: 'overview', new: 'users' });

  // <NotificationBell> below reads this; without it the page threw
  // "notifications is not defined" and the error boundary took over.
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } })
      .then(r => r.data.notifications || []).catch(() => []),
  });

  // Served by /api/admin/stats (src/modules/admin/routes.js).
  const { data: systemStats = {} } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data).catch(() => ({})),
  });

  const { data: recentUsers = [] } = useQuery({
    queryKey: ['recent-users'],
    queryFn: () => api.get('/personnel', { params: { limit: 10 } }).then(r => r.data.personnel || []).catch(() => []),
  });

  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);

  const togglePersonnel = async (id, status) => {
    setBusyId(id);
    setActionMsg(null);
    try {
      await api.put(`/personnel/${id}`, { employment_status: status });
      setActionMsg(`Personnel #${id} set to ${status}.`);
      queryClient.invalidateQueries();
    } catch (e) {
      setActionMsg(e.response?.data?.error || 'Could not update the record.');
    } finally {
      setBusyId(null);
    }
  };

  // Audit logs are served by /api/audit, not /api/audit-logs.
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/audit', { params: { limit: 20 } }).then(r => r.data.logs || []).catch(() => []),
  });

  const stats = {
    totalUsers: systemStats?.total_users ?? 0,
    activeUsers: systemStats?.active_users ?? 0,
    totalPatients: systemStats?.total_patients ?? 0,
    todayAppointments: systemStats?.today_appointments ?? 0,
    occupancyRate: systemStats?.occupancy_rate ?? 0,
    revenue: systemStats?.revenue_today ?? 0,
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
          <NotificationBell notifications={notifications} />
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
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {auditLogs.map((log, i) => (
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
                  { label: 'Create User', icon: UserPlus, color: 'blue', to: '/admin/users/new' },
                  { label: 'Manage Roles', icon: Shield, color: 'purple', to: '/admin/roles' },
                  { label: 'Manage Departments', icon: Building2, color: 'green', to: '/admin/departments' },
                  { label: 'View Audit Logs', icon: FileText, color: 'orange', to: '/admin/audit' },
                  { label: 'System Settings', icon: Settings, color: 'gray', to: '/admin/settings' },
                  { label: 'Generate Report', icon: BarChart2, color: 'teal', to: '/admin/reports' },
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
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">User Management</h2>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search users..."
                className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <Link to="/admin/users/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Add User
              </Link>
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
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
                  {recentUsers.map(personnel => (
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
                          <button onClick={() => { setSelectedPersonnel(personnel); setActiveTab('users'); }} className="text-sm text-indigo-600 hover:underline">Edit</button>
                          <button onClick={() => togglePersonnel(personnel.id, 'Active')} disabled={busyId === personnel.id} className="text-sm text-gray-600 hover:underline disabled:opacity-50">
                            {personnel.employment_status === 'Active' ? 'Disable' : 'Enable'}
                          </button>
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

      {activeTab === 'personnel' && <AdminPersonnelTab />}

      {activeTab === 'roles' && <AdminRolesTab />}

      {activeTab === 'departments' && <AdminDepartmentsTab />}

      {activeTab === 'patients' && <AdminPatientsTab />}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Audit Logs</h2>
            <input
              type="text"
              placeholder="Search logs..."
              className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
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
                  {auditLogs.map((log, i) => (
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

      {activeTab === 'reports' && <AdminReportsTab />}

      {activeTab === 'settings' && <AdminSettingsTab />}
    </div>
  );
}