import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign, CreditCard, FileText, AlertTriangle, Clock, CheckCircle,
  Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  TrendingUp, TrendingDown, Receipt, Calculator, Users, Shield,
} from 'lucide-react';
import { format } from 'date-fns';

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

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');

  const { data: billingStats } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => api.get('/billing/stats').then(r => r.data).catch(() => ({})),
  });

  const { data: recentInvoices } = useQuery({
    queryKey: ['recent-invoices'],
    queryFn: () => api.get('/billing/invoices', { params: { limit: 10 } }).then(r => r.data.invoices || []).catch(() => []),
  });

  const { data: outstandingInvoices } = useQuery({
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
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
              <a href="/billing" className="text-sm text-emerald-600 hover:underline">View All</a>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
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
                    {recentInvoices?.map(invoice => (
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
                  { label: 'Create Invoice', icon: FileText, color: 'emerald' },
                  { label: 'Record Payment', icon: CreditCard, color: 'blue' },
                  { label: 'Verify Insurance', icon: Shield, color: 'purple' },
                  { label: 'Generate Report', icon: BarChart2, color: 'orange' },
                  { label: 'Outstanding List', icon: AlertTriangle, color: 'red' },
                  { label: 'Refund Processing', icon: Calculator, color: 'gray' },
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
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Invoice management coming soon</p>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Payment recording coming soon</p>
        </div>
      )}

      {activeTab === 'insurance' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Insurance claims management coming soon</p>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Financial reports coming soon</p>
        </div>
      )}

      {activeTab === 'outstanding' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Outstanding Invoices
            </h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
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
                  {outstandingInvoices?.map(invoice => {
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
                          <button className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">Collect</button>
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