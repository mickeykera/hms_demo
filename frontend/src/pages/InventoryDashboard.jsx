import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Package, Truck, AlertTriangle, Clock, CheckCircle, Search,
  Eye, Edit, Plus, Bell, Filter, AlertCircle, DollarSign,
  FileText, RotateCcw, Shield, Settings, Box,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link , useNavigate } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';
import { useToast } from '../components/Toast';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'orders', label: 'Purchase Orders', icon: FileText },
  { id: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
  { id: 'expiring', label: 'Expiring', icon: Clock },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function BarChart2({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

// ---------- Inventory tabs ----------
// Procurement data comes from /procurement/*; physical stock from
// /pharmacy/inventory, which is the same stock the pharmacy screens.
function useMedicationName() {
  const { user } = useAuth();
  const { data: medications = [] } = useQuery({
    queryKey: ['pharmacy-medications'],
    queryFn: () => api.get('/pharmacy/medications').then(r => r.data.medications || []).catch(() => []),
    enabled: !!user?.id,
  });
  return id => {
    const m = medications.find(x => x.id === id);
    return m ? `${m.name} ${m.strength || ''}`.trim() : `Item #${id}`;
  };
}

function FullInventoryTab() {
  const { user } = useAuth();
  const nameOf = useMedicationName();
  const { data: inventory = [] } = useQuery({
    queryKey: ['pharmacy-inventory'],
    queryFn: () => api.get('/pharmacy/inventory').then(r => r.data.inventory || []).catch(() => []),
    enabled: !!user?.id,
  });

  const totalValue = inventory.reduce((s, i) => s + (i.quantity || 0) * (i.unit_cost || 0), 0);
  const field = 'px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Full Inventory</h2>
        <span className="text-sm text-gray-600">
          {inventory.length} batches • ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="p-6">
        {inventory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No stock records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Item', 'Batch', 'Qty', 'Unit Cost', 'Value', 'Expiry', 'Location'].map(h => (
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
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${((i.quantity || 0) * (i.unit_cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
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

function ExpiringTab() {
  const { user } = useAuth();
  const nameOf = useMedicationName();
  const { data: expiring = [] } = useQuery({
    queryKey: ['pharmacy-expiring'],
    queryFn: () => api.get('/pharmacy/expiring').then(r => r.data.expiring_soon || []).catch(() => []),
    enabled: !!user?.id,
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Expiring Items</h2>
        <p className="text-sm text-gray-500">Batches approaching or past their expiry date.</p>
      </div>
      <div className="p-6">
        {expiring.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nothing expiring soon.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Item', 'Batch', 'Qty', 'Expiry', 'Days Left'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expiring.map(i => {
                  const days = Math.ceil((new Date(i.expiry_date) - new Date()) / 86400000);
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{nameOf(i.medication_id)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{i.batch_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{i.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{i.expiry_date}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          days < 0 ? 'bg-red-100 text-red-800' : days < 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {days < 0 ? 'Expired' : `${days} days`}
                        </span>
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
  );
}
function SuppliersTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '', lead_time_days: '7' });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['procurement-suppliers'],
    queryFn: () => api.get('/procurement/suppliers').then(r => r.data.suppliers || []).catch(() => []),
  });

  const create = useMutation({
    mutationFn: () => api.post('/procurement/suppliers', {
      name: form.name,
      contact_person: form.contact_person || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      lead_time_days: Number(form.lead_time_days) || 7,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-suppliers'] });
      setForm({ name: '', contact_person: '', email: '', phone: '', lead_time_days: '7' });
      toast('Supplier added');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to add supplier', 'error'),
  });

  const canSubmit = form.name.trim() && !create.isPending;
  const field = 'px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Supplier Management</h2>
      </div>
      <div className="p-6 space-y-5">
        <form
          onSubmit={e => { e.preventDefault(); if (canSubmit) create.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
        >
          <div>
            <label htmlFor="sp-name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input id="sp-name" required value={form.name} className={field}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="sp-contact" className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input id="sp-contact" value={form.contact_person} className={field}
              onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="sp-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="sp-email" type="email" value={form.email} className={field}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="sp-lead" className="block text-sm font-medium text-gray-700 mb-1">Lead (days)</label>
            <input id="sp-lead" type="number" min="0" value={form.lead_time_days} className={field}
              onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <button
              type="submit" disabled={!canSubmit}
              className="w-full px-4 py-2 rounded-md bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {create.isPending ? 'Adding…' : 'Add Supplier'}
            </button>
          </div>
        </form>

        {suppliers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No suppliers registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Supplier', 'Contact', 'Email', 'Lead', 'Orders', 'Spend', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.contact_person || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.lead_time_days}d</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.order_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${(s.total_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {s.active ? 'Active' : 'Inactive'}
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
const emptyItem = () => ({ item_name: '', medication_id: '', quantity: '1', unit_cost: '0' });

function PurchaseOrdersTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [supplierId, setSupplierId] = useState('');
  const [expected, setExpected] = useState('');
  const [items, setItems] = useState([emptyItem()]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['procurement-suppliers'],
    queryFn: () => api.get('/procurement/suppliers').then(r => r.data.suppliers || []).catch(() => []),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get('/procurement/purchase-orders').then(r => r.data.orders || []).catch(() => []),
  });
  const { data: medications = [] } = useQuery({
    queryKey: ['pharmacy-medications'],
    queryFn: () => api.get('/pharmacy/medications').then(r => r.data.medications || []).catch(() => []),
    enabled: !!user?.id,
  });

  const raise = useMutation({
    mutationFn: () => api.post('/procurement/purchase-orders', {
      supplier_id: Number(supplierId),
      expected_date: expected || undefined,
      items: items.map(i => ({
        item_name: i.item_name,
        medication_id: i.medication_id ? Number(i.medication_id) : undefined,
        quantity: Number(i.quantity) || 1,
        unit_cost: Number(i.unit_cost) || 0,
      })),
    }),
    onSuccess: d => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-reports'] });
      setItems([emptyItem()]);
      setExpected('');
      toast(`Purchase order ${d.data.order_number} raised`);
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to raise order', 'error'),
  });

  const advance = useMutation({
    mutationFn: ({ id, status }) => api.put(`/procurement/purchase-orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-reports'] });
      toast('Order updated');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to update order', 'error'),
  });

  const setItem = (i, patch) => setItems(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0);
  const canSubmit = supplierId && items.every(i => i.item_name.trim()) && !raise.isPending;
  const field = 'px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
  const nextStatus = { SUBMITTED: 'APPROVED', APPROVED: 'ORDERED', ORDERED: 'RECEIVED' };
  const nextLabel = { SUBMITTED: 'Approve', APPROVED: 'Mark Ordered', ORDERED: 'Mark Received' };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Purchase Orders</h2>
      </div>
      <div className="p-6 space-y-5">
        <form onSubmit={e => { e.preventDefault(); if (canSubmit) raise.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label htmlFor="po-supplier" className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <select id="po-supplier" required value={supplierId} className={field}
                onChange={e => setSupplierId(e.target.value)}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="po-expected" className="block text-sm font-medium text-gray-700 mb-1">Expected</label>
              <input id="po-expected" type="date" value={expected} className={field}
                onChange={e => setExpected(e.target.value)} />
            </div>
            <p className="px-3 py-2 text-sm text-gray-600">
              Order total: <span className="font-semibold text-gray-900">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-4">
                {i === 0 && <label htmlFor={`po-item-${i}`} className="block text-sm font-medium text-gray-700 mb-1">Item *</label>}
                <input
                  id={`po-item-${i}`} required value={item.item_name} placeholder="Item name" className={field}
                  onChange={e => setItem(i, { item_name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-3">
                <select value={item.medication_id} className={field} aria-label="Link to catalog item"
                  onChange={e => {
                    const med = medications.find(m => String(m.id) === e.target.value);
                    setItem(i, {
                      medication_id: e.target.value,
                      item_name: med ? `${med.name} ${med.strength || ''}`.trim() : item.item_name,
                      unit_cost: med ? String(med.unit_price ?? 0) : item.unit_cost,
                    });
                  }}
                >
                  <option value="">Unlinked item</option>
                  {medications.map(m => <option key={m.id} value={m.id}>{m.name} {m.strength}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                {i === 0 && <label htmlFor={`po-qty-${i}`} className="block text-sm font-medium text-gray-700 mb-1">Qty</label>}
                <input
                  id={`po-qty-${i}`} type="number" min="1" required value={item.quantity} className={field}
                  onChange={e => setItem(i, { quantity: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                {i === 0 && <label htmlFor={`po-cost-${i}`} className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>}
                <input
                  id={`po-cost-${i}`} type="number" min="0" step="0.01" value={item.unit_cost} className={field}
                  onChange={e => setItem(i, { unit_cost: e.target.value })}
                />
              </div>
              <div className="sm:col-span-1">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                    className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-md"
                    aria-label={`Remove line ${i + 1}`}
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              type="button" onClick={() => setItems(prev => [...prev, emptyItem()])}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-white"
            >
              + Add line
            </button>
            <button
              type="submit" disabled={!canSubmit}
              className="px-4 py-2 rounded-md bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {raise.isPending ? 'Raising…' : 'Raise Order'}
            </button>
          </div>
        </form>
        {orders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No purchase orders raised.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Order #', 'Supplier', 'Lines', 'Total', 'Status', 'Advance'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{o.supplier_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{o.items?.length ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${(o.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {nextStatus[o.status] && (
                        <button
                          onClick={() => advance.mutate({ id: o.id, status: nextStatus[o.status] })}
                          disabled={advance.isPending}
                          className="text-cyan-700 hover:underline disabled:opacity-50"
                        >
                          {nextLabel[o.status]}
                        </button>
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
function InventoryReportsTab() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['procurement-reports'],
    queryFn: () => api.get('/procurement/reports').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });
  const stock = data?.stock || [];
  const t = data?.totals || {};

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Inventory Reports</h2>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Suppliers', value: t.supplier_count ?? 0 },
            { label: 'Purchase Orders', value: t.purchase_order_count ?? 0 },
            { label: 'Open Orders', value: t.open_order_count ?? 0 },
            { label: 'Committed Spend', value: `$${(t.committed_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { label: 'Stock Value', value: `$${(t.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ].map(s => (
            <div key={s.label} className="p-4 border rounded-lg">
              <p className="text-xs text-gray-500 uppercase">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {stock.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No stock to report on.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Item', 'Batches', 'Total Qty', 'Unit Price', 'Stock Value', 'Earliest Expiry'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stock.map(s => (
                  <tr key={s.medication_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {s.medication_name} {s.strength || ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.batch_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.total_quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">${s.unit_price ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${(s.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.earliest_expiry || '—'}</td>
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

// Previously this tab rendered a hardcoded array of fabricated items (fixed
// stock/min numbers) that looked real but never changed. It now reads
// /pharmacy/low-stock.
function LowStockTab() {
  const { user } = useAuth();
  const nameOf = useMedicationName();
  const { data: lowStock = [] } = useQuery({
    queryKey: ['pharmacy-low-stock'],
    queryFn: () => api.get('/pharmacy/low-stock').then(r => r.data.low_stock || []).catch(() => []),
    enabled: !!user?.id,
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold text-red-600">Low Stock Items</h2>
        <p className="text-sm text-gray-500">Batches at or below their reorder threshold.</p>
      </div>
      <div className="p-6">
        {lowStock.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No items below their reorder level.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Item', 'Batch', 'Stock', 'Expiry', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lowStock.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{nameOf(i.medication_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{i.batch_number}</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600">{i.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{i.expiry_date}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Reorder
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

export default function InventoryDashboard() {
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

  // The overview used to render hardcoded figures (1,247 items, $2,450,000
  // value, a fixed list of "low stock" supplies). Every tile below is now
  // derived from the same endpoints the individual tabs use, so the overview
  // can never disagree with the tab it summarises.
  const { data: lowStock = [] } = useQuery({
    queryKey: ['pharmacy-low-stock'],
    queryFn: () => api.get('/pharmacy/low-stock').then(r => r.data.low_stock || []).catch(() => []),
    enabled: !!user?.id,
  });
  const { data: expiring = [] } = useQuery({
    queryKey: ['pharmacy-expiring'],
    queryFn: () => api.get('/pharmacy/expiring').then(r => r.data.expiring_soon || []).catch(() => []),
    enabled: !!user?.id,
  });
  const { data: reports } = useQuery({
    queryKey: ['procurement-reports'],
    queryFn: () => api.get('/procurement/reports').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['procurement-orders'],
    queryFn: () => api.get('/procurement/purchase-orders').then(r => r.data.orders || []).catch(() => []),
    enabled: !!user?.id,
  });

  const totals = reports?.totals || {};
  const stats = {
    totalItems: (reports?.stock || []).reduce((n, s) => n + Number(s.total_quantity || 0), 0),
    lowStockItems: lowStock.length,
    expiringItems: expiring.length,
    pendingOrders: totals.open_order_count ?? 0,
    totalValue: totals.stock_value ?? 0,
    monthlySpend: totals.committed_spend ?? 0,
  };
  const activity = recentOrders.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
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
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalItems.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Alerts</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.lowStockItems}</p>
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
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.expiringItems}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.pendingOrders}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inventory Value</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">${stats.totalValue.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-100">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Spend</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">${stats.monthlySpend.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-gray-100">
              <FileText className="w-6 h-6 text-gray-600" />
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
              {tab.id === 'low-stock' && stats.lowStockItems > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{stats.lowStockItems}</span>
              )}
              {tab.id === 'expiring' && stats.expiringItems > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">{stats.expiringItems}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Items</h2>
            <div className="space-y-3">
              {lowStock.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No items below their reorder level.</p>
            ) : (
              lowStock.slice(0, 6).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.medication_name}</p>
                    <p className="text-sm text-gray-500">Batch {item.batch_number} • {item.location || 'Unassigned'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{item.quantity} units</p>
                    <button onClick={() => navigate('/inventory/orders')} className="text-xs text-blue-600 hover:underline mt-1">Reorder</button>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Create Purchase Order', icon: FileText, color: 'orange', to: '/inventory/orders' },
                  { label: 'Receive Shipment', icon: Truck, color: 'blue', to: '/inventory/orders' },
                  { label: 'Stock Adjustment', icon: RotateCcw, color: 'purple', to: '/inventory/inventory' },
                  { label: 'Transfer Stock', icon: Box, color: 'green', to: '/inventory/inventory' },
                  { label: 'Generate Report', icon: BarChart2, color: 'gray', to: '/inventory/reports' },
                  { label: 'Manage Suppliers', icon: Truck, color: 'indigo', to: '/inventory/suppliers' },
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {activity.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No purchase orders raised yet.</p>
              ) : (
                activity.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{order.order_number} • {order.supplier_name}</p>
                      <p className="text-sm text-gray-500">
                        ${Number(order.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {order.created_at ? ` • ${format(new Date(order.created_at), 'MMM dd, yyyy')}` : ''}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'RECEIVED' ? 'bg-green-100 text-green-800'
                        : order.status === 'CANCELLED' ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                ))
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && <FullInventoryTab />}

      {activeTab === 'orders' && <PurchaseOrdersTab />}

      {activeTab === 'low-stock' && <LowStockTab />}

      {activeTab === 'expiring' && <ExpiringTab />}

      {activeTab === 'suppliers' && <SuppliersTab />}

      {activeTab === 'reports' && <InventoryReportsTab />}
    </div>
  );
}