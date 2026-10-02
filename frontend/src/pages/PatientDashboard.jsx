import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useAuth } from '../context/AuthContext';
import { patientService } from '../services/api';
import { Calendar, FileText, Pill, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const SECTIONS = [
  { id: 'dashboard', path: '/patient/dashboard', label: 'Overview', icon: TrendingUp },
  { id: 'appointments', path: '/patient/appointments', label: 'Appointments', icon: Calendar },
  { id: 'records', path: '/patient/records', label: 'Records', icon: FileText },
  { id: 'prescriptions', path: '/patient/prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'lab-results', path: '/patient/lab-results', label: 'Lab Results', icon: FileText },
  { id: 'invoices', path: '/patient/invoices', label: 'Invoices', icon: Clock },
];

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Map the URL onto the section shown. imaging/messages have no dedicated
  // panel, so they resolve to the closest real one.
  const [activeSection] = useDashboardTab('dashboard', {
    appointments: 'appointments',
    records: 'records',
    prescriptions: 'prescriptions',
    'lab-results': 'lab-results',
    imaging: 'lab-results',
    invoices: 'invoices',
    messages: 'appointments',
  });
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      patientService.portal.appointments(),
      patientService.portal.prescriptions(),
      patientService.portal.labResults(),
      patientService.portal.invoices(),
    ]).then(([appointmentsResponse, prescriptionsResponse, labResponse, invoicesResponse]) => {
      if (!active) return;
      setAppointments(appointmentsResponse.data.appointments || []);
      setPrescriptions(prescriptionsResponse.data.prescriptions || []);
      setLabResults(labResponse.data.lab_results || []);
      setInvoices(invoicesResponse.data.invoices || []);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const upcomingAppointments = appointments.filter(appt => ['Scheduled', 'Confirmed'].includes(appt.status));
  const activePrescriptions = prescriptions.filter(prescription => !['DISPENSED', 'REJECTED'].includes(prescription.status));
  const outstandingBalance = invoices.reduce((total, invoice) => total + Number(invoice.balance || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Patient Portal</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user?.full_name}</p>
        </div>

        {/* Section nav. The router maps every /patient/* path to this one
            component, so the active section is derived from the URL. Each tab
            is a real route, so deep links and browser back work correctly. */}
        <nav className="mb-6 bg-white rounded-lg shadow" aria-label="Patient portal sections">
          <div className="flex overflow-x-auto border-b">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(s.path)}
                aria-current={activeSection === s.id ? 'page' : undefined}
                className={
                  'px-5 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ' +
                  (activeSection === s.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700')
                }
              >
                <s.icon className="w-4 h-4" /> {s.label}
              </button>
            ))}
          </div>
        </nav>
        {activeSection === 'dashboard' && (
          <>
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Upcoming Appointments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{upcomingAppointments.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Prescriptions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{activePrescriptions.length}</p>
              </div>
              <Pill className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Lab Results</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{labResults.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Outstanding Balance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${outstandingBalance.toFixed(2)}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Appointments */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Upcoming Appointments</h2>
            </div>
            <div className="p-6">
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No upcoming appointments</p>
                  <button onClick={() => navigate('/patient/appointments')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Book an Appointment
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingAppointments.map(appt => (
                    <div key={appt.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{appt.doctor_name}</p>
                        <p className="text-sm text-gray-600">{new Date(appt.scheduled_date).toLocaleString()}</p>
                      </div>
                      <span className="text-sm font-medium text-blue-600">{appt.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button onClick={() => navigate('/patient/appointments')} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" /> Book Appointment
              </button>
              <button onClick={() => navigate('/patient/records')} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> View Records
              </button>
              <button onClick={() => navigate('/patient/prescriptions')} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
                <Pill className="w-4 h-4" /> Prescriptions
              </button>
              <button onClick={() => navigate('/patient/invoices')} className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" /> View Invoices
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Clock className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-medium text-gray-900">Lab Result Available</p>
                  <p className="text-sm text-gray-600">CBC test results are ready for review</p>
                  <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-medium text-gray-900">Appointment Confirmed</p>
                  <p className="text-sm text-gray-600">Your appointment with Dr. Smith is confirmed</p>
                  <p className="text-xs text-gray-400 mt-1">1 day ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}

{/* Section content. Each quick action lands here with the matching data
    already fetched at the top of the component. */}
{activeSection === 'appointments' && (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">My Appointments</h2>
    {appointments.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No appointments scheduled.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Doctor', 'Type', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {appointments.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-700">
                  {a.scheduled_date ? format(new Date(a.scheduled_date), 'MMM dd, yyyy HH:mm') : '—'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.doctor_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.appointment_type || '—'}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{a.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

{activeSection === 'prescriptions' && (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">My Prescriptions</h2>
    {prescriptions.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No prescriptions on file.</p>
    ) : (
      <div className="space-y-3">
        {prescriptions.map(p => (
          <div key={p.id} className="p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-start gap-3">
              <Pill className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{p.medication_name}</p>
                <p className="text-sm text-gray-600">{p.dosage} • {p.frequency}</p>
                {p.instructions && <p className="text-xs text-gray-500 mt-1">{p.instructions}</p>}
                {p.doctor_name && <p className="text-xs text-gray-500 mt-1">Prescribed by {p.doctor_name}</p>}
              </div>
            </div>
            <span className="self-start sm:self-auto px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {p.status}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{activeSection === 'lab-results' && (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">My Lab Results</h2>
    {labResults.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No lab results available.</p>
    ) : (
      <div className="space-y-3">
        {labResults.map(t => (
          <div key={t.id} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-900">{t.test_name}</p>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{t.status}</span>
            </div>
            {(t.results || []).map((r, i) => (
              <div key={i} className="text-sm text-gray-700 border-t pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
                <span className="font-medium">{r.result_data}</span>
                {r.reference_range && <span className="text-gray-500"> (ref {r.reference_range})</span>}
              </div>
            ))}
            {t.ordered_at && (
              <p className="text-xs text-gray-500 mt-2">
                Ordered {format(new Date(t.ordered_at), 'MMM dd, yyyy')}
              </p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}

{activeSection === 'invoices' && (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">My Invoices</h2>
    {invoices.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No invoices.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="bg-gray-50">
            <tr>
              {['Invoice', 'Date', 'Total', 'Paid', 'Balance', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map(i => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.invoice_number}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {i.created_at ? format(new Date(i.created_at), 'MMM dd, yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">${Number(i.total_amount || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-green-600">${Number(i.paid_amount || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm font-medium text-red-600">${Number(i.balance || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    i.status === 'Paid' ? 'bg-green-100 text-green-800'
                      : i.status === 'Partial' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}>
                    {i.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

{activeSection === 'records' && (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">Medical Records</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 border rounded-lg">
        <p className="text-sm text-gray-600">Appointments on record</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{appointments.length}</p>
      </div>
      <div className="p-4 border rounded-lg">
        <p className="text-sm text-gray-600">Lab tests</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{labResults.length}</p>
      </div>
      <div className="p-4 border rounded-lg">
        <p className="text-sm text-gray-600">Prescriptions</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{prescriptions.length}</p>
      </div>
    </div>
    <p className="text-sm text-gray-500 mt-4">
      Full clinical notes are held by your care team. Contact reception to request a copy.
    </p>
  </div>
)}
      </div>
    </div>
  );
}
