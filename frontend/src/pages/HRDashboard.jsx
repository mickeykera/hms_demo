import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserPlus, UserCheck, Clock, DollarSign, FileText,
  Search, Eye, Edit, Plus, Bell, AlertTriangle,
  Calendar, Briefcase, Award, Shield, Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';
import { useToast } from '../components/Toast';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'leave', label: 'Leave Management', icon: Calendar },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'performance', label: 'Performance', icon: Award },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function Building2({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 21v-2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2"/><path d="M18 21V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v15"/><path d="M12 11h.01"/><path d="M12 16h.01"/><path d="M12 6.5V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5"/></svg>;
}

// ---------- HR tabs ----------
// All six read from /hr/* and /personnel. A single personnel query is shared
// across the tabs that need a name for an id.
function usePersonnel() {
  const { user } = useAuth();
  const { data: personnel = [] } = useQuery({
    queryKey: ['hr-personnel'],
    queryFn: () => api.get('/personnel').then(r => r.data.personnel || []).catch(() => []),
    enabled: !!user?.id,
  });
  return personnel;
}

const nameOfPerson = (p, id) => {
  const hit = p.find(x => x.id === id);
  if (!hit) return `Personnel #${id}`;
  return [hit.first_name, hit.last_name].filter(Boolean).join(' ') || hit.employee_id || `#${id}`;
};

function EmployeesTab() {
  const personnel = usePersonnel();
  const [search, setSearch] = useState('');
  const rows = personnel.filter(p =>
    !search ||
    `${p.first_name} ${p.last_name} ${p.employee_id} ${p.professional_title || ''}`
      .toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Employee Management</h2>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employees…"
          aria-label="Search employees"
          className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  {['Employee', 'ID', 'Title', 'Department', 'Status', 'Hired'].map(h => (
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
                    <td className="px-4 py-3 text-sm text-gray-600">{p.department || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          p.employment_status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
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

function DepartmentsTab() {
  const { user } = useAuth();
  const { data: departments = [] } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: () => api.get('/departments').then(r => r.data.departments || []).catch(() => []),
    enabled: !!user?.id,
  });
  const personnel = usePersonnel();

  const withCounts = departments.map(d => ({
    ...d,
    headcount: personnel.filter(p => p.department_id === d.id).length,
  }));

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Department Management</h2>
      </div>
      <div className="p-6">
        {withCounts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No departments configured.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {withCounts.map(d => (
              <div key={d.id} className="p-4 border rounded-lg">
                <p className="font-medium text-gray-900">{d.name}</p>
                {d.code && <p className="text-xs text-gray-500 mt-0.5">Code: {d.code}</p>}
                <p className="text-sm text-gray-600 mt-2">{d.headcount} staff</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function AttendanceTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const personnel = usePersonnel();
  const [form, setForm] = useState({
    personnel_id: '', work_date: new Date().toISOString().slice(0, 10), status: 'Present', clock_in: '', clock_out: '',
  });

  const { data: records = [] } = useQuery({
    queryKey: ['hr-attendance'],
    queryFn: () => api.get('/hr/attendance').then(r => r.data.attendance || []).catch(() => []),
  });

  const mark = useMutation({
    mutationFn: () => api.post('/hr/attendance', {
      ...form,
      personnel_id: Number(form.personnel_id),
      clock_in: form.clock_in || undefined,
      clock_out: form.clock_out || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
      toast('Attendance recorded');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to record attendance', 'error'),
  });

  const canSubmit = form.personnel_id && form.work_date && !mark.isPending;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Attendance Tracking</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canSubmit) mark.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
        >
          <div className="lg:col-span-2">
            <label htmlFor="att-person" className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select
              id="att-person" required value={form.personnel_id}
              onChange={e => setForm(f => ({ ...f, personnel_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select employee</option>
              {personnel.map(p => (
                <option key={p.id} value={p.id}>{nameOfPerson(personnel, p.id)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="att-date" className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              id="att-date" type="date" required value={form.work_date}
              onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="att-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="att-status" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {['Present', 'Late', 'Absent', 'Leave', 'HalfDay'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <button
              type="submit" disabled={!canSubmit}
              className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mark.isPending ? 'Saving…' : 'Record'}
            </button>
          </div>
        </form>

        {records.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No attendance recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Employee', 'Date', 'Status', 'Clock In', 'Clock Out'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{a.work_date}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{a.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{a.clock_in || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{a.clock_out || '—'}</td>
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
function LeaveTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const personnel = usePersonnel();
  const [form, setForm] = useState({
    personnel_id: '', leave_type: 'Annual', start_date: '', end_date: '', days: '', reason: '',
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['hr-leave'],
    queryFn: () => api.get('/hr/leave').then(r => r.data.leave || []).catch(() => []),
  });

  const create = useMutation({
    mutationFn: () => api.post('/hr/leave', {
      ...form, personnel_id: Number(form.personnel_id), days: Number(form.days),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
      setForm(f => ({ ...f, start_date: '', end_date: '', days: '', reason: '' }));
      toast('Leave request submitted');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to submit leave', 'error'),
  });

  const decide = useMutation({
    mutationFn: ({ id, status }) => api.put(`/hr/leave/${id}/decision`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
      toast('Leave request updated');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to update request', 'error'),
  });

  const canSubmit = form.personnel_id && form.start_date && form.end_date && Number(form.days) > 0 && !create.isPending;
  const field = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Leave Management</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canSubmit) create.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <div>
            <label htmlFor="lv-person" className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select
              id="lv-person" required value={form.personnel_id} className={field}
              onChange={e => setForm(f => ({ ...f, personnel_id: e.target.value }))}
            >
              <option value="">Select employee</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{nameOfPerson(personnel, p.id)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lv-type" className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select
              id="lv-type" value={form.leave_type} className={field}
              onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
            >
              {['Annual', 'Sick', 'Parental', 'Unpaid', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="lv-start" className="block text-sm font-medium text-gray-700 mb-1">From *</label>
              <input
                id="lv-start" type="date" required value={form.start_date} className={field}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="lv-end" className="block text-sm font-medium text-gray-700 mb-1">To *</label>
              <input
                id="lv-end" type="date" required value={form.end_date} className={field}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="lv-days" className="block text-sm font-medium text-gray-700 mb-1">Days *</label>
            <input
              id="lv-days" type="number" min="0.5" step="0.5" required value={form.days} className={field}
              onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="lv-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input
              id="lv-reason" value={form.reason} className={field}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit" disabled={!canSubmit}
              className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {create.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
        {requests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No leave requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Employee', 'Type', 'Dates', 'Days', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.leave_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.start_date} → {r.end_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.days}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.status === 'Approved' ? 'bg-green-100 text-green-800'
                            : r.status === 'Rejected' ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide.mutate({ id: r.id, status: 'Approved' })}
                            disabled={decide.isPending}
                            className="text-green-700 hover:underline disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => decide.mutate({ id: r.id, status: 'Rejected' })}
                            disabled={decide.isPending}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
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
function PayrollTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const personnel = usePersonnel();
  const [form, setForm] = useState({
    personnel_id: '', pay_period: new Date().toISOString().slice(0, 7),
    basic_salary: '', allowances: '0', deductions: '0', status: 'Draft',
  });

  const { data: records = [] } = useQuery({
    queryKey: ['hr-payroll'],
    queryFn: () => api.get('/hr/payroll').then(r => r.data.payroll || []).catch(() => []),
  });

  // Net pay is computed server-side; this preview is display-only.
  const preview = (Number(form.basic_salary) || 0) + (Number(form.allowances) || 0) - (Number(form.deductions) || 0);
  const total = records.reduce((s, r) => s + (r.net_pay || 0), 0);
  const field = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const run = useMutation({
    mutationFn: () => api.post('/hr/payroll', {
      personnel_id: Number(form.personnel_id),
      pay_period: form.pay_period,
      basic_salary: Number(form.basic_salary) || 0,
      allowances: Number(form.allowances) || 0,
      deductions: Number(form.deductions) || 0,
      status: form.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
      toast('Payroll record saved');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to save payroll', 'error'),
  });

  const canSubmit = form.personnel_id && form.pay_period && form.basic_salary !== '' && !run.isPending;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Payroll Processing</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canSubmit) run.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div>
            <label htmlFor="pr-person" className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select
              id="pr-person" required value={form.personnel_id} className={field}
              onChange={e => setForm(f => ({ ...f, personnel_id: e.target.value }))}
            >
              <option value="">Select employee</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{nameOfPerson(personnel, p.id)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pr-period" className="block text-sm font-medium text-gray-700 mb-1">Pay Period *</label>
            <input
              id="pr-period" type="month" required value={form.pay_period} className={field}
              onChange={e => setForm(f => ({ ...f, pay_period: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="pr-basic" className="block text-sm font-medium text-gray-700 mb-1">Basic *</label>
            <input
              id="pr-basic" type="number" min="0" step="0.01" required value={form.basic_salary} className={field}
              onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="pr-allow" className="block text-sm font-medium text-gray-700 mb-1">Allowances</label>
            <input
              id="pr-allow" type="number" min="0" step="0.01" value={form.allowances} className={field}
              onChange={e => setForm(f => ({ ...f, allowances: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="pr-ded" className="block text-sm font-medium text-gray-700 mb-1">Deductions</label>
            <input
              id="pr-ded" type="number" min="0" step="0.01" value={form.deductions} className={field}
              onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="pr-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="pr-status" value={form.status} className={field}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {['Draft', 'Approved', 'Paid'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <p className="px-3 py-2 text-sm text-gray-600">
              Net: <span className="font-semibold text-gray-900">
                ${preview.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          <div className="flex items-end">
            <button
              type="submit" disabled={!canSubmit}
              className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {run.isPending ? 'Saving…' : 'Save Payroll'}
            </button>
          </div>
        </form>
        {records.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No payroll records.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Total committed:{' '}
              <span className="font-semibold">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50">
                  <tr>
                    {['Employee', 'Period', 'Basic', 'Allow.', 'Deduct.', 'Net', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.full_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.pay_period}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">${r.basic_salary?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-green-600">${r.allowances?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-red-600">${r.deductions?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">${r.net_pay?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function PerformanceTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const personnel = usePersonnel();
  const [form, setForm] = useState({
    personnel_id: '', review_period: '', rating: '4', strengths: '', improvements: '', goals: '', status: 'Draft',
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['hr-reviews'],
    queryFn: () => api.get('/hr/reviews').then(r => r.data.reviews || []).catch(() => []),
  });

  const save = useMutation({
    mutationFn: () => api.post('/hr/reviews', {
      personnel_id: Number(form.personnel_id),
      review_period: form.review_period,
      rating: Number(form.rating),
      strengths: form.strengths || undefined,
      improvements: form.improvements || undefined,
      goals: form.goals || undefined,
      status: form.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
      setForm(f => ({ ...f, strengths: '', improvements: '', goals: '' }));
      toast('Review saved');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to save review', 'error'),
  });

  const canSubmit = form.personnel_id && form.review_period && !save.isPending;
  const field = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const rated = reviews.filter(r => r.rating);
  const avg = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : '—';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Performance Reviews</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canSubmit) save.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div>
            <label htmlFor="pf-person" className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select
              id="pf-person" required value={form.personnel_id} className={field}
              onChange={e => setForm(f => ({ ...f, personnel_id: e.target.value }))}
            >
              <option value="">Select employee</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{nameOfPerson(personnel, p.id)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pf-period" className="block text-sm font-medium text-gray-700 mb-1">Review Period *</label>
            <input
              id="pf-period" required placeholder="e.g. 2026-Q3" value={form.review_period} className={field}
              onChange={e => setForm(f => ({ ...f, review_period: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="pf-rating" className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
            <select
              id="pf-rating" value={form.rating} className={field}
              onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pf-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="pf-status" value={form.status} className={field}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {['Draft', 'Shared', 'Acknowledged'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pf-strengths" className="block text-sm font-medium text-gray-700 mb-1">Strengths</label>
            <textarea
              id="pf-strengths" rows={2} value={form.strengths} className={field}
              onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pf-improve" className="block text-sm font-medium text-gray-700 mb-1">Areas for improvement</label>
            <textarea
              id="pf-improve" rows={2} value={form.improvements} className={field}
              onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit" disabled={!canSubmit}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {save.isPending ? 'Saving…' : 'Save Review'}
            </button>
          </div>
        </form>
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No reviews recorded.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Average rating: <span className="font-semibold">{avg} / 5</span>
            </p>
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{r.full_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-medium">
                        {r.rating}/5
                      </span>
                      <span className="text-xs text-gray-500">{r.review_period}</span>
                    </div>
                  </div>
                  {r.strengths && (
                    <p className="text-sm text-gray-700"><span className="font-medium">Strengths:</span> {r.strengths}</p>
                  )}
                  {r.improvements && (
                    <p className="text-sm text-gray-700"><span className="font-medium">Improve:</span> {r.improvements}</p>
                  )}
                  {r.goals && (
                    <p className="text-sm text-gray-700"><span className="font-medium">Goals:</span> {r.goals}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function HRDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');

  // <NotificationBell> below reads this; without it the page threw
  // "notifications is not defined" and the error boundary took over.
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } })
      .then(r => r.data.notifications || []).catch(() => []),
  });

  // These tiles were hardcoded (156 employees, $450,000 payroll, 8 on leave).
  // They now read the same endpoints the tabs below them use, so the header can
  // never contradict the Attendance/Leave/Payroll tabs. "Open Positions" was
  // removed entirely: there is no job-postings table behind it, so any number
  // shown would have been invented.
  const { data: summary } = useQuery({
    queryKey: ['hr-summary'],
    queryFn: () => api.get('/hr/summary').then(r => r.data || {}).catch(() => ({})),
    enabled: !!user?.id,
  });
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['hr-attendance', today],
    queryFn: () => api.get('/hr/attendance', { params: { date: today } })
      .then(r => r.data.attendance || []).catch(() => []),
    enabled: !!user?.id,
  });

  const stats = {
    totalEmployees: summary?.headcount ?? 0,
    presentToday: summary?.present_today ?? 0,
    onLeave: todayAttendance.filter(a => a.status === 'Leave').length,
    avgRating: Number(summary?.avg_rating ?? 0).toFixed(1),
    pendingLeave: summary?.pending_leave ?? 0,
    payrollThisMonth: summary?.payroll_committed ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
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
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalEmployees}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.presentToday}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Leave</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.onLeave}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Rating</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.avgRating}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Leave</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.pendingLeave}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Payroll This Month</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">${stats.payrollThisMonth.toLocaleString()}</p>
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Hires</h2>
            <div className="space-y-3">
              {[
                { name: 'Dr. Sarah Johnson', role: 'Cardiologist', dept: 'Cardiology', date: '2024-01-15' },
                { name: 'Nurse Maria Santos', role: 'RN', dept: 'ICU', date: '2024-01-10' },
                { name: 'Tech James Wilson', role: 'Lab Tech', dept: 'Laboratory', date: '2024-01-08' },
              ].map((emp, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-sm text-gray-500">{emp.role} • {emp.dept} • {format(new Date(emp.date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Hire New Employee', icon: UserPlus, color: 'purple', to: '/hr/employees' },
                  { label: 'Process Leave Request', icon: Calendar, color: 'blue', to: '/hr/leave' },
                  { label: 'Run Payroll', icon: DollarSign, color: 'emerald', to: '/hr/payroll' },
                  { label: 'Schedule Training', icon: Award, color: 'orange', to: '/hr/performance' },
                  { label: 'View Attendance', icon: Clock, color: 'indigo', to: '/hr/attendance' },
                  { label: 'Generate Report', icon: FileText, color: 'gray', to: '/hr/departments' },
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Leave</h2>
              <div className="space-y-3">
                {[
                  { name: 'Dr. Robert Chen', type: 'Annual Leave', dates: 'Jan 20-26', status: 'Approved' },
                  { name: 'Nurse Lisa Park', type: 'Sick Leave', dates: 'Jan 18-19', status: 'Pending' },
                ].map((leave, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{leave.name}</p>
                      <p className="text-sm text-gray-500">{leave.type} • {leave.dates}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${leave.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'employees' && <EmployeesTab />}

      {activeTab === 'departments' && <DepartmentsTab />}

      {activeTab === 'attendance' && <AttendanceTab />}

      {activeTab === 'leave' && <LeaveTab />}

      {activeTab === 'payroll' && <PayrollTab />}

      {activeTab === 'performance' && <PerformanceTab />}
    </div>
  );
}