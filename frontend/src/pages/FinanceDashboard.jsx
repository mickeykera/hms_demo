import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign, CreditCard, FileText, AlertTriangle, Clock, CheckCircle,
  Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  TrendingUp, TrendingDown, Receipt, Calculator, Users, Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link , useNavigate } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';
import { useToast } from '../components/Toast';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'insurance', label: 'Insurance', icon: Shield },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'outstanding', label: 'Outstanding', icon: AlertTriangle },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function BarChart2({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

// Shared invoice list for the finance tabs. `statusFilter` scopes the query.
function useInvoices(statusFilter, limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['billing-invoices', statusFilter, limit],
    queryFn: () =>
      api.get('/billing/invoices', { params: { status: statusFilter || undefined, limit } })
        .then(r => r.data.invoices || []).catch(() => []),
    enabled: !!user?.id,
  });
}

function InvoiceTable({ invoices, action }) {
  if (!invoices.length) {
    return <p className="text-gray-500 text-center py-8">No invoices found.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="bg-gray-50">
          <tr>
            {['Invoice #', 'Patient', 'Date', 'Total', 'Paid', 'Balance', 'Status', ''].map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {invoices.map(inv => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {inv.patient_first} {inv.patient_last}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {format(new Date(inv.created_at), 'MMM d, yyyy')}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">${inv.total_amount?.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-green-600">${inv.paid_amount?.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm font-medium text-red-600">${inv.balance?.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    inv.status === 'Paid'
                      ? 'bg-green-100 text-green-800'
                      : inv.status === 'Partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">{action ? action(inv) : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Invoices tab -------------------------------------------------------
function InvoiceManager() {
  const [filter, setFilter] = useState('');
  const { data: invoices = [], isLoading } = useInvoices(filter);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Invoice Management</h2>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter invoices by status"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All statuses</option>
          {['Unpaid', 'Partial', 'Paid'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-center py-8">Loading…</p> : <InvoiceTable invoices={invoices} />}
      </div>
    </div>
  );
}

// ---- Payments tab -------------------------------------------------------
function PaymentRecorder() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: invoices = [] } = useInvoices('Unpaid');
  const { data: partials = [] } = useInvoices('Partial');
  const [target, setTarget] = useState({ id: '', amount: '' });

  const pay = useMutation({
    mutationFn: () => api.put(`/billing/${target.id}/pay`, { amount: Number(target.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      setTarget({ id: '', amount: '' });
      toast('Payment recorded');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to record payment', 'error'),
  });

  const due = [...invoices, ...partials];
  const canPay = target.id && Number(target.amount) > 0 && !pay.isPending;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Record Payment</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canPay) pay.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-3 items-end"
        >
          <div>
            <label htmlFor="pay-invoice" className="block text-sm font-medium text-gray-700 mb-1">Invoice *</label>
            <select
              id="pay-invoice"
              required
              value={target.id}
              onChange={e => {
                const inv = due.find(i => String(i.id) === e.target.value);
                setTarget({ id: e.target.value, amount: inv ? String(inv.balance) : '' });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select an unpaid invoice</option>
              {due.map(i => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} — {i.patient_first} {i.patient_last} (${i.balance})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={target.amount}
              onChange={e => setTarget(t => ({ ...t, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!canPay}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pay.isPending ? 'Recording…' : 'Record Payment'}
          </button>
        </form>

        <InvoiceTable invoices={due} />
      </div>
    </div>
  );
}
// ---- Insurance tab ------------------------------------------------------
function InsurancePanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: invoices = [] } = useInvoices('');
  const [selected, setSelected] = useState('');

  const verify = useMutation({
    mutationFn: () =>
      api.put(`/billing/${selected}/insurance-check`, { provider: 'Verified', policy_number: 'POL-' + selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      setSelected('');
      toast('Insurance verified');
    },
    onError: err => toast(err?.response?.data?.error || 'Insurance check failed', 'error'),
  });

  const insurance = invoices.filter(i => i.insurance_applicable);
  const canVerify = selected && !verify.isPending;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Insurance Claims</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canVerify) verify.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-[2fr_auto] gap-3 items-end"
        >
          <div>
            <label htmlFor="ins-invoice" className="block text-sm font-medium text-gray-700 mb-1">
              Invoice requiring insurance verification
            </label>
            <select
              id="ins-invoice"
              required
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select an invoice</option>
              {insurance.filter(i => i.status !== 'Paid').map(i => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} — {i.patient_first} {i.patient_last} (${i.balance})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!canVerify}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verify.isPending ? 'Verifying…' : 'Verify Coverage'}
          </button>
        </form>

        {insurance.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No insurance-applicable invoices.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Invoice #', 'Patient', 'Amount', 'Insurance Status', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {insurance.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{i.patient_first} {i.patient_last}</td>
                    <td className="px-4 py-3 text-sm">${i.total_amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {i.insurance_status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{i.status}</td>
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
// ---- Reports tab --------------------------------------------------------
function FinanceReports() {
  const { user } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => api.get('/billing/stats').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });
  const { data: invoices = [] } = useInvoices('', 200);

  const byStatus = ['Paid', 'Partial', 'Unpaid'].map(status => {
    const rows = invoices.filter(i => i.status === status);
    return { status, count: rows.length, total: rows.reduce((s, i) => s + (i.total_amount || 0), 0) };
  });
  const collectionRate = stats?.total_billed
    ? Math.round(((stats.total_collected || 0) / stats.total_billed) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Financial Reports</h2>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Billed', value: `$${(stats?.total_billed || 0).toLocaleString()}` },
            { label: 'Total Collected', value: `$${(stats?.total_collected || 0).toLocaleString()}` },
            { label: 'Outstanding', value: `$${(stats?.outstanding_amount || 0).toLocaleString()}` },
            { label: 'Collection Rate', value: `${collectionRate}%` },
          ].map(s => (
            <div key={s.label} className="p-4 border rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Invoices by Status</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Status', 'Count', 'Total Value'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {byStatus.map(r => (
                  <tr key={r.status}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.status}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.count}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">${r.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');

  // <NotificationBell> below reads this; without it the page threw
  // "notifications is not defined" and the error boundary took over.
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } })
      .then(r => r.data.notifications || []).catch(() => []),
  });

  const { data: billingStats = [] } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => api.get('/billing/stats').then(r => r.data).catch(() => ({})),
  });

  const { data: recentInvoices = [] } = useQuery({
    queryKey: ['recent-invoices'],
    queryFn: () => api.get('/billing/invoices', { params: { limit: 10 } }).then(r => r.data.invoices || []).catch(() => []),
  });

  const { data: outstandingInvoices = [] } = useQuery({
    queryKey: ['outstanding-invoices'],
    queryFn: () => api.get('/billing/invoices', { params: { status: 'Unpaid', limit: 20 } }).then(r => r.data.invoices || []).catch(() => []),
  });

  const stats = {
    todayRevenue: billingStats?.today_revenue || 0,
    outstandingAmount: billingStats?.outstanding_amount || 0,
    unpaidInvoices: billingStats?.unpaid_count || 0,
    partialInvoices: billingStats?.partial_count || 0,
    insurancePending: billingStats?.insurance_pending || 0,
    collectedToday: billingStats?.collected_today || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
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
              <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">${stats.todayRevenue?.toLocaleString() || '0'}</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-100">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Collected Today</p>
              <p className="text-3xl font-bold text-green-600 mt-1">${stats.collectedToday?.toLocaleString() || '0'}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Outstanding Amount</p>
              <p className="text-3xl font-bold text-red-600 mt-1">${stats.outstandingAmount?.toLocaleString() || '0'}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unpaid Invoices</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.unpaidInvoices}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Partial Payments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.partialInvoices}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Insurance Pending</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.insurancePending}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Shield className="w-6 h-6 text-blue-600" />
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
              {tab.id === 'outstanding' && stats.unpaidInvoices > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{stats.unpaidInvoices}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Invoices */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
              <a href="/billing" className="text-sm text-emerald-600 hover:underline">View All</a>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recentInvoices.map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{invoice.patient_first} {invoice.patient_last}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">${invoice.total_amount?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-green-600">${invoice.paid_amount?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-medium text-red-600">${invoice.balance?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : invoice.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {invoice.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Create Invoice', icon: FileText, color: 'emerald', to: '/finance/invoices' },
                  { label: 'Record Payment', icon: CreditCard, color: 'blue', to: '/finance/payments' },
                  { label: 'Verify Insurance', icon: Shield, color: 'purple', to: '/finance/insurance' },
                  { label: 'Generate Report', icon: BarChart2, color: 'orange', to: '/finance/reports' },
                  { label: 'Outstanding List', icon: AlertTriangle, color: 'red', to: '/finance/outstanding' },
                  { label: 'Refund Processing', icon: Calculator, color: 'gray', to: '/finance/payments' },
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 7 Days)</h2>
              <div className="h-48 flex items-end justify-around gap-2">
                {[12000, 19000, 15000, 22000, 18000, 25000, 20000].map((value, i) => (
                  <div key={i} className="flex-1 max-w-xs">
                    <div className="bg-emerald-500 rounded-t transition-all hover:bg-emerald-600" style={{ height: `${(value / 25000) * 100}%` }} />
                    <p className="text-xs text-center mt-1 text-gray-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <InvoiceManager />
      )}

      {activeTab === 'payments' && (
        <PaymentRecorder />
      )}

      {activeTab === 'insurance' && (
        <InsurancePanel />
      )}

      {activeTab === 'reports' && (
        <FinanceReports />
      )}

      {activeTab === 'outstanding' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Outstanding Invoices
            </h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Overdue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {outstandingInvoices.map(invoice => {
                    const daysOverdue = Math.floor((new Date() - new Date(invoice.created_at)) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{invoice.patient_first} {invoice.patient_last}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">${invoice.total_amount?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-medium text-red-600">${invoice.balance?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${daysOverdue > 30 ? 'bg-red-100 text-red-800' : daysOverdue > 7 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {daysOverdue} days
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => navigate('/finance/payments')} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">Collect</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}