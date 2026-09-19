import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Package, Truck, AlertTriangle, Clock, CheckCircle, Search,
  Eye, Edit, Plus, Bell, Filter, AlertCircle, DollarSign,
  FileText, RotateCcw, Shield, Settings, Box,
} from 'lucide-react';
import { format } from 'date-fns';

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

export default function InventoryDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');

  const stats = {
    totalItems: 1247,
    lowStockItems: 23,
    expiringItems: 15,
    pendingOrders: 8,
    totalValue: 2450000,
    monthlySpend: 185000,
  };

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
              {[
                { name: 'Syringe 10ml', category: 'Medical Supplies', stock: 5, min: 50, unit: 'pcs' },
                { name: 'IV Catheter 18G', category: 'Medical Supplies', stock: 12, min: 30, unit: 'pcs' },
                { name: 'Gloves Nitrile L', category: 'PPE', stock: 8, min: 100, unit: 'boxes' },
                { name: 'Normal Saline 500ml', category: 'Fluids', stock: 15, min: 40, unit: 'bags' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.category} • Min: {item.min} {item.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{item.stock} {item.unit}</p>
                    <button className="text-xs text-blue-600 hover:underline mt-1">Reorder</button>
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
                  { label: 'Create Purchase Order', icon: FileText, color: 'orange' },
                  { label: 'Receive Shipment', icon: Truck, color: 'blue' },
                  { label: 'Stock Adjustment', icon: RotateCcw, color: 'purple' },
                  { label: 'Transfer Stock', icon: Box, color: 'green' },
                  { label: 'Generate Report', icon: BarChart2, color: 'gray' },
                  { label: 'Manage Suppliers', icon: Truck, color: 'indigo' },
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {[
                  { action: 'Received', item: 'Syringe 10ml', qty: '500 pcs', time: '2 hours ago' },
                  { action: 'Ordered', item: 'IV Catheter 18G', qty: '200 pcs', time: '5 hours ago' },
                  { action: 'Adjusted', item: 'Gloves Nitrile L', qty: '-50 boxes', time: '1 day ago' },
                ].map((act, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{act.action} {act.item}</p>
                      <p className="text-sm text-gray-500">Qty: {act.qty} • {act.time}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${act.action === 'Received' ? 'bg-green-100 text-green-800' : act.action === 'Ordered' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {act.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Full inventory management coming soon</p>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Purchase order management coming soon</p>
        </div>
      )}

      {activeTab === 'low-stock' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Low Stock Items
            </h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    { name: 'Syringe 10ml', category: 'Medical Supplies', stock: 5, min: 50, unit: 'pcs' },
                    { name: 'IV Catheter 18G', category: 'Medical Supplies', stock: 12, min: 30, unit: 'pcs' },
                    { name: 'Gloves Nitrile L', category: 'PPE', stock: 8, min: 100, unit: 'boxes' },
                    { name: 'Normal Saline 500ml', category: 'Fluids', stock: 15, min: 40, unit: 'bags' },
                    { name: 'Blood Collection Tube', category: 'Lab Supplies', stock: 20, min: 50, unit: 'pcs' },
                  ].map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.category}</td>
                      <td className="px-6 py-4 text-sm font-bold text-red-600">{item.stock}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.min}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.unit}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Critical</span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Reorder</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expiring' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Expiring items tracking coming soon</p>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Supplier management coming soon</p>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Inventory reports coming soon</p>
        </div>
      )}
    </div>
  );
}