import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity, Image, AlertTriangle, Clock, CheckCircle,
  Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  FileText, Microscope, User,
} from 'lucide-react';
import { format } from 'date-fns';

const tabs = [
  { id: 'queue', label: 'Imaging Queue', icon: Activity },
  { id: 'scheduled', label: 'Scheduled', icon: Calendar },
  { id: 'in-progress', label: 'In Progress', icon: Image },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'critical', label: 'Critical', icon: AlertTriangle },
];

function Calendar({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}

export default function RadiologyDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('queue');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: imagingQueue } = useQuery({
    queryKey: ['radiology-queue'],
    queryFn: () => api.get('/radiology/queue').then(r => r.data.queue || []),
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const stats = {
    ordered: imagingQueue?.filter(o => o.status === 'ORDERED').length || 0,
    scheduled: imagingQueue?.filter(o => o.status === 'SCHEDULED').length || 0,
    inProgress: imagingQueue?.filter(o => o.status === 'IN_PROGRESS').length || 0,
    reportPending: imagingQueue?.filter(o => o.status === 'REPORT_PENDING').length || 0,
    reported: imagingQueue?.filter(o => o.status === 'REPORTED').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radiology Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-medium">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ordered</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.ordered}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scheduled</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.scheduled}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.inProgress}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Image className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Report Pending</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.reportPending}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.reported}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
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
            placeholder="Search by patient, modality, body part..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500"
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modality</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Body Part</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clinical Indication</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {imagingQueue?.filter(order => {
                    const matchesSearch = !searchQuery || 
                      `${order.first_name} ${order.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      order.modality?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      order.body_part?.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  }).map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-pink-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{order.first_name} {order.last_name}</p>
                            <p className="text-sm text-gray-500">{order.global_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.modality === 'CT' ? 'bg-blue-100 text-blue-800' : order.modality === 'MRI' ? 'bg-purple-100 text-purple-800' : order.modality === 'X-Ray' ? 'bg-green-100 text-green-800' : order.modality === 'Ultrasound' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                          {order.modality}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{order.body_part}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{order.clinical_indication || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.priority === 'Stat' ? 'bg-red-100 text-red-800' : order.priority === 'Urgent' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'ORDERED' ? 'bg-yellow-100 text-yellow-800' : order.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' : order.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-800' : order.status === 'REPORT_PENDING' ? 'bg-purple-100 text-purple-800' : order.status === 'REPORTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(order.ordered_at), 'MMM d, HH:mm')}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Dr. {order.doctor_name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="text-sm text-pink-600 hover:underline">View</button>
                          {['ORDERED', 'SCHEDULED'].includes(order.status) && <button className="text-sm text-blue-600 hover:underline">Schedule</button>}
                          {order.status === 'IN_PROGRESS' && <button className="text-sm text-green-600 hover:underline">Complete</button>}
                          {order.status === 'REPORT_PENDING' && <button className="text-sm text-purple-600 hover:underline">Write Report</button>}
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

      {activeTab === 'scheduled' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Scheduled imaging view coming soon</p>
        </div>
      )}

      {activeTab === 'in-progress' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">In-progress imaging view coming soon</p>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Radiology reports coming soon</p>
        </div>
      )}

      {activeTab === 'critical' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Critical Findings
            </h2>
          </div>
          <div className="p-6">
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-gray-600">No critical findings at this time</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}