import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, DollarSign, Calendar, FlaskConical, Bed, 
  Cpu, Scissors, Pill, TrendingUp, Clock, AlertTriangle, CheckCircle, Stethoscope,
  Building2, FileText, Shield, Heart, Activity, Microscope, TestTube,
} from 'lucide-react';
import { format } from 'date-fns';

const statCards = [
  { key: 'totalPatients', label: 'Total Patients', icon: Users, color: 'blue' },
  { key: 'pendingAppointments', label: 'Pending Appointments', icon: Calendar, color: 'orange' },
  { key: 'unpaidInvoices', label: 'Unpaid Invoices', icon: DollarSign, color: 'red' },
  { key: 'pendingLabTests', label: 'Pending Lab Tests', icon: FlaskConical, color: 'purple' },
  { key: 'occupiedBeds', label: 'Occupied Beds', icon: Bed, color: 'green' },
  { key: 'activeIoT', label: 'Active IoT Devices', icon: Cpu, color: 'indigo' },
];

export default function Dashboard() {
  const { canAccess, user } = useAuth();
  const [stats, setStats] = useState({});

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [patients, appointments, billing, lab, ward] = await Promise.all([
          api.get('/reception/queue/General').catch(() => ({ data: { waiting_patients: [] } })),
          api.get('/appointments', { params: { status: 'Scheduled' } }).catch(() => ({ data: { appointments: [] } })),
          api.get('/billing/status/1').catch(() => ({ data: { total_outstanding: 0 } })),
          api.get('/lab/1').catch(() => ({ data: { tests: [] } })),
          api.get('/ward/beds').catch(() => ({ data: { available_beds: [] } })),
        ]);
        setStats({
          totalPatients: patients.data.waiting_patients?.length || 0,
          pendingAppointments: appointments.data.appointments?.length || 0,
          unpaidInvoices: billing.data.total_outstanding || 0,
          pendingLabTests: lab.data.tests?.filter(t => t.test.status !== 'Completed').length || 0,
          occupiedBeds: 10 - (ward.data.available_beds?.length || 0),
          activeIoT: 5,
        });
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      }
    };
    fetchStats();
  }, []);

  const getQuickActions = () => {
    const actions = [];
    if (canAccess('Reception')) actions.push({ label: 'New Patient', path: '/reception', icon: Users });
    if (canAccess('Appointments')) actions.push({ label: 'Schedule Appointment', path: '/appointments', icon: Calendar });
    if (canAccess('Billing')) actions.push({ label: 'Create Invoice', path: '/billing', icon: DollarSign });
    if (canAccess('Laboratory')) actions.push({ label: 'Order Lab Test', path: '/lab', icon: FlaskConical });
    if (canAccess('Pharmacy')) actions.push({ label: 'Manage Medications', path: '/pharmacy', icon: Pill });
    if (canAccess('Radiology')) actions.push({ label: 'Order Imaging', path: '/radiology', icon: Activity });
    if (canAccess('Ward')) actions.push({ label: 'Manage Beds', path: '/ward', icon: Bed });
    if (canAccess('OR')) actions.push({ label: 'Schedule Surgery', path: '/or', icon: Scissors });
    if (canAccess('Clinical')) actions.push({ label: 'New Consultation', path: '/clinical', icon: Stethoscope });
    return actions;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Hospital Management System Overview • {user?.displayRole || user?.role}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {user?.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats[key] || 0}</p>
              </div>
              <div className={`p-3 rounded-full bg-${color}-100`}>
                <Icon className={`w-6 h-6 text-${color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {getQuickActions().map(({ label, path, icon: Icon }) => (
              <a key={label} href={path} className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition">
                <Icon className="w-8 h-8 text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h2>
          <div className="space-y-3">
            {[
              { type: 'warning', message: '3 lab tests overdue', time: '10 min ago' },
              { type: 'info', message: '2 beds need cleaning', time: '25 min ago' },
              { type: 'success', message: 'Invoice INV-ABC123 paid', time: '1 hour ago' },
              { type: 'warning', message: 'IoT device HRM-001 offline', time: '2 hours ago' },
            ].map((alert, i) => (
              <div key={i} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`p-2 rounded-full ${alert.type === 'warning' ? 'bg-yellow-100' : alert.type === 'success' ? 'bg-green-100' : 'bg-blue-100'}`}>
                  {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                  {alert.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {alert.type === 'info' && <Clock className="w-5 h-5 text-blue-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Module Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-10 gap-4">
          {[
            { label: 'Reception', icon: Users, module: 'Reception' },
            { label: 'Clinical', icon: Stethoscope, module: 'Clinical' },
            { label: 'Billing', icon: DollarSign, module: 'Billing' },
            { label: 'Lab', icon: FlaskConical, module: 'Laboratory' },
            { label: 'Ward', icon: Bed, module: 'Ward' },
            { label: 'IoT', icon: Cpu, module: 'IoT' },
            { label: 'OR', icon: Scissors, module: 'OR' },
            { label: 'Appointments', icon: Calendar, module: 'Appointments' },
            { label: 'Pharmacy', icon: Pill, module: 'Pharmacy' },
            { label: 'Radiology', icon: Activity, module: 'Radiology' },
          ].map(({ label, icon: Icon, module }) => {
            const hasAccess = canAccess(module);
            return (
              <div key={label} className={`p-4 rounded-lg text-center ${hasAccess ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200 opacity-50'}`}>
                <Icon className={`w-8 h-8 mx-auto mb-2 ${hasAccess ? 'text-green-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-medium ${hasAccess ? 'text-green-800' : 'text-gray-500'}`}>{label}</p>
                <p className={`text-xs mt-1 ${hasAccess ? 'text-green-600' : 'text-gray-400'}`}>
                  {hasAccess ? 'Accessible' : 'Restricted'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}