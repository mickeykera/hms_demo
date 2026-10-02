import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Pill, Package, AlertTriangle, Clock, CheckCircle,
  Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  TrendingUp, FileText, DollarSign, Shield, Truck,
} from 'lucide-react';
import { format } from 'date-fns';
import NotificationBell from '../components/NotificationBell';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'queue', label: 'Prescription Queue', icon: Pill },
  { id: 'dispensing', label: 'Dispensing', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
  { id: 'expiring', label: 'Expiring', icon: Clock },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
];

// Dispensing workflow: pick a queued prescription, choose the medication to
// dispense against it, and POST to /pharmacy/dispense.
function DispensingTab({ queue }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ prescription_id: '', medication_id: '', quantity: '', instructions: '' });

  const { data: medications = [] } = useQuery({
    queryKey: ['pharmacy-medications'],
    queryFn: () => api.get('/pharmacy/medications').then(r => r.data.medications || []).catch(() => []),
    enabled: !!user?.id,
  });

  const dispense = useMutation({
    mutationFn: () => api.post('/pharmacy/dispense', {
      prescription_id: Number(form.prescription_id),
      medication_id: Number(form.medication_id),
      quantity: Number(form.quantity),
      instructions: form.instructions || undefined,
      dispensed_by: user?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-inventory'] });
      setForm({ prescription_id: '', medication_id: '', quantity: '', instructions: '' });
      toast('Medication dispensed');
    },
    onError: err => toast(err?.response?.data?.error || 'Dispensing failed', 'error'),
  });

  const canDispense = form.prescription_id && form.medication_id && Number(form.quantity) > 0 && !dispense.isPending;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Dispensing Workflow</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canDispense) dispense.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div className="sm:col-span-2">
            <label htmlFor="disp-rx" className="block text-sm font-medium text-gray-700 mb-1">Prescription *</label>
            <select
              id="disp-rx"
              required
              value={form.prescription_id}
              onChange={e => setForm(f => ({ ...f, prescription_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select a prescription</option>
              {queue.map(p => (
                <option key={p.id} value={p.id}>
                  {p.medication_name} — {p.patient_first} {p.patient_last} ({p.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="disp-med" className="block text-sm font-medium text-gray-700 mb-1">Medication *</label>
            <select
              id="disp-med"
              required
              value={form.medication_id}
              onChange={e => setForm(f => ({ ...f, medication_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select medication</option>
              {medications.map(m => (
                <option key={m.id} value={m.id}>{m.name} {m.strength} • {m.form}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="disp-qty" className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              id="disp-qty"
              type="number"
              min="1"
              required
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="disp-inst" className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <input
              id="disp-inst"
              value={form.instructions}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              placeholder="Label text for the patient"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!canDispense}
              className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dispense.isPending ? 'Dispensing…' : 'Dispense Medication'}
            </button>
          </div>
        </form>

        {queue.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No prescriptions awaiting dispensing.</p>
        ) : (
          <div className="space-y-2">
            {queue.map(p => (
              <div key={p.id} className="p-3 border rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.medication_name}</p>
                  <p className="text-xs text-gray-500">
                    {p.patient_first} {p.patient_last} • {p.dosage} • {p.frequency}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Full stock view: every batch, plus low-stock and expiring counts.
function PharmacyInventoryTab({ lowStock, expiring }) {
  const { user } = useAuth();
  const { data: inventory = [] } = useQuery({
    queryKey: ['pharmacy-inventory'],
    queryFn: () => api.get('/pharmacy/inventory').then(r => r.data.inventory || []).catch(() => []),
    enabled: !!user?.id,
  });
  const { data: medications = [] } = useQuery({
    queryKey: ['pharmacy-medications'],
    queryFn: () => api.get('/pharmacy/medications').then(r => r.data.medications || []).catch(() => []),
    enabled: !!user?.id,
  });

  const nameOf = id => {
    const m = medications.find(x => x.id === id);
    return m ? `${m.name} ${m.strength || ''}`.trim() : `Medication #${id}`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Inventory Management</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 border rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Batches</p>
            <p className="text-xl font-bold text-gray-900">{inventory.length}</p>
          </div>
          <div className="p-3 border rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Low Stock</p>
            <p className="text-xl font-bold text-red-600">{lowStock.length}</p>
          </div>
          <div className="p-3 border rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Expiring</p>
            <p className="text-xl font-bold text-yellow-600">{expiring.length}</p>
          </div>
        </div>
        {inventory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No inventory records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Item', 'Batch', 'Qty', 'Unit Cost', 'Expiry', 'Location'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventory.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{nameOf(i.medication_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{i.batch_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{i.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">${i.unit_cost ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{i.expiry_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{i.location || '—'}</td>
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

// Supplier management reuses the procurement module's supplier records.
function PharmacySuppliersTab() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const { data: suppliers = [] } = useQuery({
    queryKey: ['procurement-suppliers'],
    queryFn: () => api.get('/procurement/suppliers').then(r => r.data.suppliers || []).catch(() => []),
    enabled: !!user?.id,
  });
  const rows = suppliers.filter(s =>
    !filter || `${s.name} ${s.contact_person || ''} ${s.email || ''}`.toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Supplier Management</h2>
        <input
          type="text" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search suppliers..." aria-label="Search suppliers"
          className="w-full sm:w-64 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="p-6">
        {rows.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No suppliers registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Supplier', 'Contact', 'Phone', 'Lead', 'Orders', 'Spend'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.contact_person || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.lead_time_days}d</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.order_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${(s.total_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionMsg, setActionMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reorderStock = async (id) => {
    setBusyId(id); setActionMsg(null);
    try {
      await api.post('/pharmacy/inventory', {
        medication_id: id, batch_number: 'REORDER-' + id,
        quantity: 100, expiry_date: '2027-12-31', location: 'Restock', unit_cost: 3.5,
      });
      setActionMsg('Stock reordered successfully.');
      queryClient.invalidateQueries();
    } catch (e) {
      setActionMsg(e.response?.data?.error || 'Reorder failed.');
    } finally { setBusyId(null); }
  };

  const updatePrescription = async (id, status, label) => {
    setBusyId(id); setActionMsg(null);
    try {
      await api.put(`/pharmacy/${id}/status`, { status });
      setActionMsg(`${label} succeeded.`);
      queryClient.invalidateQueries();
    } catch (e) {
      setActionMsg(e.response?.data?.error || `${label} failed.`);
    } finally { setBusyId(null); }
  };
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('queue');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: prescriptionQueue = [] } = useQuery({
    queryKey: ['pharmacy-queue'],
    queryFn: () => api.get('/pharmacy/queue').then(r => r.data.queue || []),
    refetchInterval: 30000,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/pharmacy/low-stock').then(r => r.data.low_stock || []),
    refetchInterval: 300000,
  });

  const { data: expiring = [] } = useQuery({
    queryKey: ['expiring'],
    queryFn: () => api.get('/pharmacy/expiring').then(r => r.data.expiring_soon || []),
    refetchInterval: 300000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const stats = {
    pending: prescriptionQueue.filter(p => p.status === 'ORDERED').length || 0,
    review: prescriptionQueue.filter(p => p.status === 'REVIEW_PENDING').length || 0,
    approved: prescriptionQueue.filter(p => p.status === 'APPROVED').length || 0,
    dispensing: prescriptionQueue.filter(p => p.status === 'DISPENSING').length || 0,
    lowStock: lowStock.length || 0,
    expiring: expiring.length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
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
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pending + stats.review}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.approved}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Dispensing</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.dispensing}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Alerts</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.lowStock}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.expiring}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total in Queue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{prescriptionQueue.length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <Pill className="w-6 h-6 text-green-600" />
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
              {tab.id === 'low-stock' && stats.lowStock > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{stats.lowStock}</span>
              )}
              {tab.id === 'expiring' && stats.expiring > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">{stats.expiring}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient, medication, doctor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {prescriptionQueue.filter(p => {
                    const matchesSearch = !searchQuery || 
                      `${p.patient_first} ${p.patient_last}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.medication_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.doctor_name?.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  }).map(prescription => (
                    <tr key={prescription.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Pill className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{prescription.patient_first} {prescription.patient_last}</p>
                            <p className="text-sm text-gray-500">{prescription.patient_global_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{prescription.medication_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{prescription.dosage}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{prescription.frequency}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{prescription.duration_days ? `${prescription.duration_days} days` : '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Dr. {prescription.doctor_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${prescription.status === 'ORDERED' ? 'bg-yellow-100 text-yellow-800' : prescription.status === 'REVIEW_PENDING' ? 'bg-orange-100 text-orange-800' : prescription.status === 'APPROVED' ? 'bg-green-100 text-green-800' : prescription.status === 'DISPENSING' ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'}`}>
                          {prescription.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updatePrescription(prescription.id, 'DISPENSING', 'View')} className="text-sm text-green-600 hover:underline">View</button>
                          {prescription.status === 'APPROVED' && <button onClick={() => updatePrescription(prescription.id, 'DISPENSED', 'Dispense')} disabled={busyId === prescription.id} className="text-sm text-blue-600 hover:underline disabled:opacity-50">Dispense</button>}
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

      {activeTab === 'dispensing' && (
        <DispensingTab queue={prescriptionQueue} />
      )}

      {activeTab === 'inventory' && (
        <PharmacyInventoryTab lowStock={lowStock} expiring={expiring} />
      )}

      {activeTab === 'low-stock' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Low Stock Medications
            </h2>
          </div>
          <div className="p-6">
            {lowStock.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-gray-600">All medications adequately stocked</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strength</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Form</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lowStock.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{item.medication_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{item.strength}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{item.form}</td>
                        <td className="px-6 py-4 text-sm font-medium text-red-600">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">10</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{item.batch_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{format(new Date(item.expiry_date), 'MMM d, yyyy')}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => reorderStock(item.medication_id)} disabled={busyId === item.medication_id} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">Reorder</button>
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

      {activeTab === 'expiring' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-orange-600 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Expiring Medications
            </h2>
          </div>
          <div className="p-6">
            {expiring.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-gray-600">No medications expiring soon</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expiring.map(item => {
                      const daysLeft = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{item.medication_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{item.batch_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{item.quantity}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{format(new Date(item.expiry_date), 'MMM d, yyyy')}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${daysLeft <= 7 ? 'bg-red-100 text-red-800' : daysLeft <= 30 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {daysLeft} days
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button onClick={() => reorderStock(item.medication_id)} disabled={busyId === item.medication_id} className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50">Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && <PharmacySuppliersTab />}
    </div>
  );
}