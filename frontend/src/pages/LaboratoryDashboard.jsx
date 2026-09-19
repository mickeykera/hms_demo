import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FlaskConical, TestTube, AlertTriangle, Clock, CheckCircle,
  Users, Search, Eye, Edit, Plus, Bell, Filter, AlertCircle,
  Package, Droplet, Microscope, TrendingUp, FileText,
} from 'lucide-react';
import { format } from 'date-fns';

const tabs = [
  { id: 'queue', label: 'Test Queue', icon: FlaskConical },
  { id: 'samples', label: 'Samples', icon: TestTube },
  { id: 'in-progress', label: 'In Progress', icon: Microscope },
  { id: 'results', label: 'Results', icon: FileText },
  { id: 'critical', label: 'Critical', icon: AlertTriangle },
  { id: 'inventory', label: 'Inventory', icon: Package },
];

export default function LaboratoryDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: labQueue } = useQuery({
    queryKey: ['lab-queue'],
    queryFn: () => api.get('/lab/queue/pending').then(r => r.data.queue || []),
    refetchInterval: 30000,
  });

  const { data: criticalResults } = useQuery({
    queryKey: ['critical-results'],
    queryFn: () => api.get('/lab/critical').then(r => r.data.results || []).catch(() => []),
    refetchInterval: 60000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } }).then(r => r.data.notifications || []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const stats = {
    pending: labQueue?.filter(t => ['Ordered', 'CollectionPending'].includes(t.status)).length || 0,
    collected: labQueue?.filter(t => t.status === 'Collected').length || 0,
    inProgress: labQueue?.filter(t => t.status === 'InProgress').length || 0,
    verified: labQueue?.filter(t => t.status === 'Verified').length || 0,
    critical: criticalResults?.length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratory Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
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
              <p className="text-sm font-medium text-gray-600">Pending Collection</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pending}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Samples Collected</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.collected}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <TestTube className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tests In Progress</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.inProgress}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Microscope className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Results Verified</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.verified}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Results</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.critical}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total in Queue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{labQueue?.length || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <FlaskConical className="w-6 h-6 text-purple-600" />
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
              {tab.id === 'critical' && stats.critical > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{stats.critical}</span>
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
            placeholder="Search by patient name, test name, sample ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Statuses</option>
          <option value="Ordered">Ordered</option>
          <option value="CollectionPending">Collection Pending</option>
          <option value="Collected">Collected</option>
          <option value="InProgress">In Progress</option>
          <option value="Verified">Verified</option>
          <option value="Released">Released</option>
        </select>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {labQueue?.filter(test => {
                    const matchesSearch = !searchQuery || 
                      `${test.first_name} ${test.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      test.test_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      test.sample_id?.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStatus = statusFilter === 'all' || test.status === statusFilter;
                    return matchesSearch && matchesStatus;
                  }).map(test => (
                    <tr key={test.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{test.first_name} {test.last_name}</p>
                            <p className="text-sm text-gray-500">{test.global_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{test.test_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{test.test_type || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${test.priority === 'Stat' ? 'bg-red-100 text-red-800' : test.priority === 'Urgent' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                          {test.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${test.status === 'Ordered' ? 'bg-yellow-100 text-yellow-800' : test.status === 'CollectionPending' ? 'bg-orange-100 text-orange-800' : test.status === 'Collected' ? 'bg-blue-100 text-blue-800' : test.status === 'InProgress' ? 'bg-purple-100 text-purple-800' : test.status === 'Verified' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {test.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(test.ordered_at), 'MMM d, HH:mm')}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Dr. {test.doctor_name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="text-sm text-purple-600 hover:underline">View</button>
                          <button className="text-sm text-green-600 hover:underline">Collect</button>
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

      {activeTab === 'samples' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Sample tracking coming soon</p>
        </div>
      )}

      {activeTab === 'in-progress' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">In-progress tests view coming soon</p>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Results management coming soon</p>
        </div>
      )}

      {activeTab === 'critical' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Critical Results Requiring Attention
            </h2>
          </div>
          <div className="p-6">
            {criticalResults?.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-gray-600">No critical results at this time</p>
              </div>
            ) : (
              <div className="space-y-4">
                {criticalResults.map(result => (
                  <div key={result.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-red-900">{result.test_name}</p>
                        <p className="text-sm text-red-700">{result.patient_name} • {result.global_id}</p>
                        <p className="text-sm text-red-600 mt-1">Value: {result.result_value} {result.unit} (Ref: {result.reference_range})</p>
                        <p className="text-xs text-red-500 mt-1">Flagged at: {format(new Date(result.flagged_at), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                      <button className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">Acknowledge</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Laboratory inventory management coming soon</p>
        </div>
      )}
    </div>
  );
}