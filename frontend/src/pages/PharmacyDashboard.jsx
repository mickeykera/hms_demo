import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Pill, Package, AlertTriangle, Clock, CheckCircle,
  Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  TrendingUp, FileText, DollarSign, Shield, Truck,
} from 'lucide-react';
import { format } from 'date-fns';

const tabs = [
  { id: 'queue', label: 'Prescription Queue', icon: Pill },
  { id: 'dispensing', label: 'Dispensing', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
  { id: 'expiring', label: 'Expiring', icon: Clock },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
];

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('queue');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: prescriptionQueue } = useQuery({
    queryKey: ['pharmacy-queue'],
    queryFn: () => api.get('/pharmacy/queue').then(r => r.data.queue || []),
    refetchInterval: 30000,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/pharmacy/low-stock').then(r => r.data.low_stock || []),
    refetchInterval: 300000,
  });

  const { data: expiring } = useQuery({
    queryKey: ['expiring'],
    queryFn: () => api.get('/pharmacy/expiring').then(r => r.data.expiring_soon || []),
    refetchInterval: 300000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const stats = {
    pending: prescriptionQueue?.filter(p => p.status === 'ORDERED').length || 0,
    review: prescriptionQueue?.filter(p => p.status === 'REVIEW_PENDING').length || 0,
    approved: prescriptionQueue?.filter(p => p.status === 'APPROVED').length || 0,
    dispensing: prescriptionQueue?.filter(p => p.status === 'DISPENSING').length || 0,
    lowStock: lowStock?.length || 0,
    expiring: expiring?.length || 0,
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{prescriptionQueue?.length || 0}</p>
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
              <table className="w-full">
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
                  {prescriptionQueue?.filter(p => {
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
                          <button className="text-sm text-green-600 hover:underline">View</button>
                          {prescription.status === 'APPROVED' && <button className="text-sm text-blue-600 hover:underline">Dispense</button>}
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
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Dispensing workflow coming soon</p>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Inventory management coming soon</p>
        </div>
      )}

      {activeTab === 'low-stock' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Low Stock Medications
            </h2>
          </div>
          <div className="p-6">
            {lowStock?.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-gray-600">All medications adequately stocked</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
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
                          <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Reorder</button>
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
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-orange-600 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Expiring Medications
            </h2>
          </div>
          <div className="p-6">
            {expiring?.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-gray-600">No medications expiring soon</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
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
                            <button className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">Remove</button>
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

      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Supplier management coming soon</p>
        </div>
      )}
    </div>
  );
}