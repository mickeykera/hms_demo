import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, DollarSign, Calendar, FlaskConical, Bed,
  Cpu, Scissors, Pill, Stethoscope,
  Building2, Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getColor } from '../utils/colorMap';

// Every tile here reads a real endpoint. Three were removed rather than
// re-scoped, because there was nothing real to scope them to:
//
//   'Unpaid Invoices'   was /billing/status/1 -- patient id 1, a hardcoded
//                      guess at "whoever is first in the table". On a hospital
//                      install that is a real patient's balance, shown to
//                      whoever opens the dashboard.
//   'Pending Lab Tests' was /lab/1 -- same problem.
//   'Active IoT Devices' was the literal 5. The iot module exposes only
//                      per-patient telemetry (/iot/:patientId); there is no
//                      device-count endpoint at all.
//
// 'Occupied Beds' was also removed: it was computed as `10 - available`, where
// the 10 was a hardcoded total. /ward/beds returns available beds only, with no
// total, so occupancy was being derived from a fiction. The real per-ward
// occupancy lives at /wards/stats/occupancy, which is restricted to
// Admin/SuperAdmin/Doctor/Nurse -- and /dashboard is open to every role, so
// wiring it here would hand other roles a 403. The tile now reports the figure
// the endpoint can actually support.
const statCards = [
  { key: 'patientsWaiting', label: 'Patients Waiting', icon: Users, color: 'blue' },
  { key: 'pendingAppointments', label: 'Pending Appointments', icon: Calendar, color: 'orange' },
  { key: 'availableBeds', label: 'Available Beds', icon: Bed, color: 'green' },
];

export default function Dashboard() {
  const { canAccess, user } = useAuth();
  const [stats, setStats] = useState({});

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [queue, appointments, ward] = await Promise.all([
          api.get('/reception/queue/General').catch(() => ({ data: { waiting_patients: [] } })),
          api.get('/appointments', { params: { status: 'Scheduled' } }).catch(() => ({ data: { appointments: [] } })),
          api.get('/ward/beds').catch(() => ({ data: { available_beds: [] } })),
        ]);
        setStats({
          patientsWaiting: queue.data.waiting_patients.length || 0,
          pendingAppointments: appointments.data.appointments.length || 0,
          availableBeds: ward.data.available_beds.length || 0,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Hospital Management System Overview • {user?.displayRole || user?.role}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ key, label, icon: Icon, color }) => {
          const colors = getColor(color);
          return (
            <div key={key} className={`stat-card ${colors.bg} border-border`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-label">{label}</p>
                  <p className="stat-value">{stats[key] || 0}</p>
                </div>
                <div className={`p-3 rounded-full ${colors.icon}`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {getQuickActions().map(({ label, path, icon: Icon }) => (
                <Link key={label} to={path} className="flex flex-col items-center p-4 border border-border rounded-lg hover:bg-gray-50 transition">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 mt-2">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Alerts.
            This panel was removed. It rendered a hardcoded array of four fake
            alerts -- "3 lab tests overdue", "Invoice INV-ABC123 paid", "IoT
            device HRM-001 offline" with invented timestamps. On a hospital
            dashboard that is fabricated clinical and financial activity, and it
            reads as real. There is no alerts endpoint to replace it with, so
            the honest option was to remove it rather than leave it or wire it
            to something unrelated. A real alerts feed needs its own backend
            work -- see the security-posture "what does not exist" list.
        */}
      </div>

      {/* Module Access */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Module Access</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-4">
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
    </div>
  );
}