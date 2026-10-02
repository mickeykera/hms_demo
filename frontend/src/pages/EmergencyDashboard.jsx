import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, Heart, Users, Clock, CheckCircle, Search,
  Eye, Edit, Plus, Bell, AlertCircle, Stethoscope,
  Activity, Droplet, Thermometer, Weight, Shield,
  Ambulance, Cross, Zap, Flag as FlagIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link , useNavigate } from 'react-router-dom';
import { getColor } from '../utils/colorMap';
import NotificationBell from '../components/NotificationBell';
import { useToast } from '../components/Toast';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'triage', label: 'Triage Queue', icon: FlagIcon },
  { id: 'patients', label: 'Active Patients', icon: Users },
  { id: 'ambulance', label: 'Ambulance', icon: Ambulance },
  { id: 'resources', label: 'Resources', icon: Shield },
  { id: 'stats', label: 'Statistics', icon: BarChart2 },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function BarChart2({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

function Flag({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
}

// ---------- Emergency / ED tabs ----------
// Triage and active-patient views are derived from the visits table via
// /reception/queue/:department; ambulance, resources and stats from
// /api/emergency.
function TriageTab() {
  const { user } = useAuth();
  const [dept, setDept] = useState('Emergency');
  const { data: queue = [] } = useQuery({
    queryKey: ['ed-queue', dept],
    queryFn: () => api.get(`/reception/queue/${dept}`).then(r => r.data.queue || r.data.patients || []).catch(() => []),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Triage Queue</h2>
        <select
          value={dept}
          onChange={e => setDept(e.target.value)}
          aria-label="Department queue"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {['Emergency', 'Outpatient', 'ICU', 'General'].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="p-6">
        {queue.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No patients waiting in this queue.</p>
        ) : (
          <div className="space-y-3">
            {queue.map(v => (
              <div key={v.id} className="p-4 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold">
                    {v.triage_priority ?? '—'}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {v.first_name} {v.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {v.visit_type} • {v.department} • queue #{v.queue_position ?? '—'}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivePatientsTab() {
  const { user } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ['ed-stats'],
    queryFn: () => api.get('/emergency/statistics').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });

  const { data: queue = [] } = useQuery({
    queryKey: ['ed-active'],
    queryFn: () => api.get('/reception/queue/Emergency')
      .then(r => r.data.queue || r.data.patients || []).catch(() => []),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const t = stats?.totals || {};

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Active Patients</h2>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Waiting', value: t.waiting_now ?? 0 },
            { label: 'In Consultation', value: t.in_consultation ?? 0 },
            { label: 'Completed', value: t.completed_total ?? 0 },
            { label: 'Visits Today', value: t.visits_today ?? 0 },
          ].map(s => (
            <div key={s.label} className="p-4 border rounded-lg">
              <p className="text-xs text-gray-500 uppercase">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
        {queue.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No patients currently active in ED.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Patient', 'Type', 'Priority', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {queue.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {v.first_name} {v.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{v.visit_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.triage_priority}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{v.status}</span>
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
function AmbulanceTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    ambulance_id: '', incident_location: '', incident_type: '',
    priority: 'Routine', patient_name: '', destination: '', eta_minutes: '',
  });
  const { data: fleet = [] } = useQuery({
    queryKey: ['ed-ambulances'],
    queryFn: () => api.get('/emergency/ambulances').then(r => r.data.ambulances || []).catch(() => []),
  });
  const { data: dispatches = [] } = useQuery({
    queryKey: ['ed-dispatches'],
    queryFn: () => api.get('/emergency/dispatches').then(r => r.data.dispatches || []).catch(() => []),
  });
  const dispatch = useMutation({
    mutationFn: () => api.post('/emergency/dispatches', {
      ambulance_id: form.ambulance_id ? Number(form.ambulance_id) : undefined,
      incident_location: form.incident_location,
      incident_type: form.incident_type || undefined,
      priority: form.priority,
      patient_name: form.patient_name || undefined,
      destination: form.destination || undefined,
      eta_minutes: form.eta_minutes ? Number(form.eta_minutes) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ed-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['ed-ambulances'] });
      setForm(f => ({ ...f, incident_location: '', incident_type: '', patient_name: '', destination: '', eta_minutes: '' }));
      toast('Ambulance dispatched');
    },
    onError: err => toast(err?.response?.data?.error || 'Dispatch failed', 'error'),
  });
  const advance = useMutation({
    mutationFn: ({ id, status }) => api.put(`/emergency/dispatches/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ed-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['ed-ambulances'] });
      toast('Dispatch updated');
    },
    onError: err => toast(err?.response?.data?.error || 'Failed to update dispatch', 'error'),
  });
  const available = fleet.filter(a => a.status === 'Available');
  const canSubmit = form.incident_location.trim() && !dispatch.isPending;
  const fld = 'px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500';
  const nextStep = { Dispatched: 'EnRoute', EnRoute: 'AtScene', AtScene: 'Returning', Returning: 'Completed' };
  const nextLabel = { Dispatched: 'En Route', EnRoute: 'At Scene', AtScene: 'Returning', Returning: 'Complete' };
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Ambulance Dispatch</h2>
        <p className="text-sm text-gray-500">{available.length} of {fleet.length} units available</p>
      </div>
      <div className="p-6 space-y-5">
        <form onSubmit={e => { e.preventDefault(); if (canSubmit) dispatch.mutate(); }}
          className="p-4 border rounded-lg bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="dp-unit" className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select id="dp-unit" value={form.ambulance_id} className={fld}
              onChange={e => setForm(x => ({ ...x, ambulance_id: e.target.value }))}>
              <option value="">No specific unit</option>
              {available.map(a => <option key={a.id} value={a.id}>{a.unit_number} - {a.vehicle_type}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dp-loc" className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <input id="dp-loc" required value={form.incident_location} className={fld}
              onChange={e => setForm(x => ({ ...x, incident_location: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="dp-type" className="block text-sm font-medium text-gray-700 mb-1">Incident</label>
            <input id="dp-type" value={form.incident_type} className={fld}
              onChange={e => setForm(x => ({ ...x, incident_type: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="dp-pri" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select id="dp-pri" value={form.priority} className={fld}
              onChange={e => setForm(x => ({ ...x, priority: e.target.value }))}>
              {['Routine', 'Urgent', 'Emergency', 'Critical'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dp-pat" className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <input id="dp-pat" value={form.patient_name} className={fld}
              onChange={e => setForm(x => ({ ...x, patient_name: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="dp-dest" className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
            <input id="dp-dest" value={form.destination} className={fld}
              onChange={e => setForm(x => ({ ...x, destination: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="dp-eta" className="block text-sm font-medium text-gray-700 mb-1">ETA (min)</label>
            <input id="dp-eta" type="number" min="0" value={form.eta_minutes} className={fld}
              onChange={e => setForm(x => ({ ...x, eta_minutes: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={!canSubmit}
              className="w-full px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {dispatch.isPending ? 'Dispatching…' : 'Dispatch'}
            </button>
          </div>
        </form>
        {dispatches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No dispatches recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Location', 'Unit', 'Priority', 'Status', 'Advance'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dispatches.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {d.incident_location}
                      {d.patient_name && <span className="block text-xs text-gray-500">{d.patient_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{d.unit_number || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        d.priority === 'Critical' ? 'bg-red-100 text-red-800'
                          : d.priority === 'Emergency' ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {d.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {nextStep[d.status] && (
                        <button
                          onClick={() => advance.mutate({ id: d.id, status: nextStep[d.status] })}
                          disabled={advance.isPending}
                          className="text-red-700 hover:underline disabled:opacity-50"
                        >
                          {nextLabel[d.status]}
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

function ResourcesTab() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['ed-resources'],
    queryFn: () => api.get('/emergency/resources').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });
  const beds = data?.beds || [];
  const ambulances = data?.ambulances || [];
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">Resource Management</h2>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Beds ({beds.length})</h3>
          {beds.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">No beds configured.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {beds.map(b => (
                <div key={b.id} className={`p-3 border rounded-lg ${
                  b.status === 'Occupied' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                }`}>
                  <p className="font-medium text-gray-900 text-sm">
                    {b.ward_name} • {b.bed_number}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{b.bed_type || 'Standard'}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    b.status === 'Occupied' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Fleet ({ambulances.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ambulances.map(a => (
              <div key={a.id} className="p-3 border rounded-lg">
                <p className="font-medium text-gray-900 text-sm">{a.unit_number}</p>
                <p className="text-xs text-gray-600">{a.vehicle_type} • crew {a.crew_size}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EdStatsTab() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['ed-stats'],
    queryFn: () => api.get('/emergency/statistics').then(r => r.data).catch(() => ({})),
    enabled: !!user?.id,
  });
  const t = data?.totals || {};
  const bar = 'px-4 py-3 text-sm text-gray-700';
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg font-semibold">ED Statistics</h2>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Visits Today', value: t.visits_today ?? 0 },
            { label: 'Waiting Now', value: t.waiting_now ?? 0 },
            { label: 'In Consultation', value: t.in_consultation ?? 0 },
            { label: 'Emergency Visits', value: t.emergency_visits ?? 0 },
            { label: 'Completed (all)', value: t.completed_total ?? 0 },
            { label: 'Avg Stay', value: `${Number(t.avg_length_of_stay_days || 0).toFixed(2)} d` },
            { label: 'Triage P1-P5 (open)', value: (data?.byPriority || []).reduce((s, p) => s + p.count, 0) },
            { label: 'Ambulance Units', value: (data?.fleet || []).reduce((s, f) => s + f.count, 0) },
          ].map(s => (
            <div key={s.label} className="p-4 border rounded-lg">
              <p className="text-xs text-gray-500 uppercase">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Open cases by triage priority</h3>
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                {(data?.byPriority || []).map(p => (
                  <tr key={p.priority}>
                    <td className={bar}>Priority {p.priority}</td>
                    <td className={`${bar} text-right font-medium`}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Visit types (last 7 days)</h3>
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                {(data?.byType || []).map(v => (
                  <tr key={v.type}>
                    <td className={bar}>{v.type}</td>
                    <td className={`${bar} text-right font-medium`}>{v.count}</td>
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

export default function EmergencyDashboard() {
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

  // These tiles were hardcoded (12 waiting, 3 critical, 18 active). Every value
  // now comes from /emergency/statistics, which derives them from the live
  // visits, beds and ambulance tables -- the same source the Stats tab shows.
  const { data: edStats } = useQuery({
    queryKey: ['ed-statistics'],
    queryFn: () => api.get('/emergency/statistics').then(r => r.data || {}).catch(() => ({})),
    enabled: !!user?.id,
  });

  const totals = edStats?.totals || {};
  const bedsByStatus = edStats?.beds || [];
  const fleetByStatus = edStats?.fleet || [];
  const countWhere = (rows, status) => rows.find(r => r.status === status)?.count ?? 0;

  const stats = {
    waitingTriage: totals.waiting_now ?? 0,
    criticalPatients: (edStats?.byPriority || [])
      .filter(p => Number(p.priority) === 1)
      .reduce((n, p) => n + p.count, 0),
    activePatients: totals.in_consultation ?? 0,
    availableBeds: countWhere(bedsByStatus, 'Available'),
    ambulancesActive: fleetByStatus
      .filter(f => f.status !== 'Available')
      .reduce((n, f) => n + f.count, 0),
    ambulancesAvailable: countWhere(fleetByStatus, 'Available'),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Department Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <NotificationBell notifications={notifications} />
        </div>
      </div>

      {/* Critical Alert Banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-red-900">CRITICAL ALERT</p>
            <p className="text-sm text-red-700">{stats.criticalPatients} patient{stats.criticalPatients === 1 ? '' : 's'} in critical condition requiring immediate attention</p>
          </div>
          <button onClick={() => navigate('/emergency/triage')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">View Critical Patients</button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Waiting Triage</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.waitingTriage}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <Flag className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Patients</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{stats.criticalPatients}</p>
            </div>
            <div className="p-3 rounded-full bg-red-200">
              <Heart className="w-6 h-6 text-red-700" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Patients</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.activePatients}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available ED Beds</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.availableBeds}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ambulances Active</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{stats.ambulancesActive}</p>
            </div>
            <div className="p-3 rounded-full bg-amber-100">
              <Ambulance className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ambulances Available</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">{stats.ambulancesAvailable}</p>
            </div>
            <div className="p-3 rounded-full bg-gray-100">
              <Ambulance className="w-6 h-6 text-gray-600" />
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
              {tab.id === 'triage' && stats.waitingTriage > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{stats.waitingTriage}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Triage Queue */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-600" /> Triage Queue
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { pos: 1, name: 'John Doe', age: 45, chief: 'Chest pain', triage: 1, time: '10:15', vitals: 'BP 180/110 HR 110' },
                  { pos: 2, name: 'Jane Smith', age: 32, chief: 'Severe abdominal pain', triage: 2, time: '10:20', vitals: 'BP 140/90 HR 95' },
                  { pos: 3, name: 'Bob Wilson', age: 28, chief: 'Laceration forehead', triage: 3, time: '10:25', vitals: 'BP 120/80 HR 85' },
                  { pos: 4, name: 'Alice Brown', age: 67, chief: 'Shortness of breath', triage: 2, time: '10:30', vitals: 'BP 150/95 HR 105 SpO2 92%' },
                  { pos: 5, name: 'Mike Davis', age: 19, chief: 'Ankle injury', triage: 4, time: '10:35', vitals: 'BP 110/70 HR 75' },
                ].map((patient, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                    <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                      {patient.pos}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${patient.triage === 1 ? 'bg-red-100 text-red-800' : patient.triage === 2 ? 'bg-orange-100 text-orange-800' : patient.triage === 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          ESI {patient.triage}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{patient.chief} • Age {patient.age}</p>
                      <p className="text-xs text-gray-500">{patient.vitals}</p>
                    </div>
                    <span className="text-sm text-gray-500">{patient.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Register Trauma', icon: Cross, color: 'red', to: '/emergency/triage' },
                  { label: 'Call Code Blue', icon: Zap, color: 'red', to: '/emergency/patients' },
                  { label: 'Request Ambulance', icon: Ambulance, color: 'amber', to: '/emergency/ambulance' },
                  { label: 'Order Stat Labs', icon: Activity, color: 'purple', to: '/laboratory/queue' },
                  { label: 'Order Stat Imaging', icon: Stethoscope, color: 'blue', to: '/radiology/queue' },
                  { label: 'Administer Meds', icon: Droplet, color: 'green', to: '/pharmacy/queue' },
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ambulance Status</h2>
              <div className="space-y-3">
                {[
                  { id: 'AMB-01', status: 'En Route', eta: '5 min', type: 'ALS' },
                  { id: 'AMB-02', status: 'At Scene', eta: '-', type: 'BLS' },
                  { id: 'AMB-03', status: 'Transporting', eta: '12 min', type: 'ALS' },
                  { id: 'AMB-04', status: 'Available', eta: '-', type: 'BLS' },
                  { id: 'AMB-05', status: 'Available', eta: '-', type: 'ALS' },
                ].map((amb, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{amb.id} ({amb.type})</p>
                      <p className="text-sm text-gray-500">ETA: {amb.eta}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${amb.status === 'Available' ? 'bg-green-100 text-green-800' : amb.status === 'En Route' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                      {amb.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'triage' && <TriageTab />}

      {activeTab === 'patients' && <ActivePatientsTab />}

      {activeTab === 'ambulance' && <AmbulanceTab />}

      {activeTab === 'resources' && <ResourcesTab />}

      {activeTab === 'stats' && <EdStatsTab />}
    </div>
  );
}