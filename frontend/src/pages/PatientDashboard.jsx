import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientService } from '../services/api';
import { Calendar, FileText, Pill, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export default function PatientDashboard() {
  const { user } = useAuth();
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
                  <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" /> Book Appointment
              </button>
              <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> View Records
              </button>
              <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
                <Pill className="w-4 h-4" /> Prescriptions
              </button>
              <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2">
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
      </div>
    </div>
  );
}
