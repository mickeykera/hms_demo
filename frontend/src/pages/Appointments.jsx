import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsService, patientService, clinicalService } from '../services/api';
import { 
  Plus, Search, Eye, Calendar, Clock, UserPlus, 
  AlertCircle, Loader2, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, MoreVertical,
  Edit, Trash2, Download
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth, isSameDay, isToday } from 'date-fns';

const statusColors = {
  Scheduled: 'bg-blue-100 text-blue-800',
  Confirmed: 'bg-green-100 text-green-800',
  InProgress: 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-gray-100 text-gray-800',
  Cancelled: 'bg-red-100 text-red-800',
  NoShow: 'bg-red-100 text-red-800',
};

const typeColors = {
  Consultation: 'bg-blue-100 text-blue-800',
  FollowUp: 'bg-green-100 text-green-800',
  Procedure: 'bg-purple-100 text-purple-800',
  Checkup: 'bg-orange-100 text-orange-800',
};

export default function Appointments() {
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [appointmentData, setAppointmentData] = useState({
    patient_id: '', doctor_id: '', scheduled_date: '', duration_minutes: 30,
    appointment_type: 'Consultation', notes: ''
  });
  const [filters, setFilters] = useState({ doctor_id: '', status: '', date: '' });
  const queryClient = useQueryClient();

  const { data: appointments } = useQuery({
    queryKey: ['appointments', filters],
    queryFn: () => appointmentsService.list(filters).then(r => r.data.appointments || []),
  });

  const { data: patients } = useQuery({
    queryKey: ['apptPatients'],
    queryFn: () => patientService.search('').then(r => r.data.patients || []),
  });

  const { data: doctors } = useQuery({
    queryKey: ['apptDoctors'],
    queryFn: () => clinicalService.getDoctors ? clinicalService.getDoctors() : Promise.resolve({ data: [] }).then(r => r.data || []),
  });

  const createMutation = useMutation({
    mutationFn: appointmentsService.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); setShowModal(false); resetForm(); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => appointmentsService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); setShowModal(false); setEditingAppointment(null); resetForm(); }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => appointmentsService.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] })
  });

  const resetForm = () => setAppointmentData({ patient_id: '', doctor_id: '', scheduled_date: '', duration_minutes: 30, appointment_type: 'Consultation', notes: '' });

  const navigateDate = (days) => setCurrentDate(d => addDays(d, days));
  const goToToday = () => setCurrentDate(new Date());

  const getWeekDays = (date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getMonthDays = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const startWeek = startOfWeek(start, { weekStartsOn: 1 });
    const endWeek = endOfWeek(end, { weekStartsOn: 1 });
    const days = [];
    let current = startWeek;
    while (current <= endWeek) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  };

  const dayAppointments = (day) => appointments?.filter(a => isSameDay(new Date(a.scheduled_date), day)) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600">Schedule and manage patient appointments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={goToToday} className="btn-secondary">Today</button>
          <button onClick={() => navigateDate(view === 'week' ? -7 : -30)} className="btn-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => navigateDate(view === 'week' ? 7 : 30)} className="btn-secondary"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> New Appointment
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-2">
            {['week', 'month', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm rounded ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <select value={filters.doctor_id} onChange={e => setFilters({...filters, doctor_id: e.target.value})} className="input w-auto">
              <option value="">All Doctors</option>
              {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.last_name}</option>)}
            </select>
            <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="input w-auto">
              <option value="">All Status</option>
              {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {view === 'week' && (
        <div className="grid grid-cols-7 gap-1">
          {getWeekDays(currentDate).map(day => (
            <div key={day.toISOString()} className="bg-white rounded-lg shadow min-h-[200px] p-2">
              <div className={`text-center py-2 rounded-t ${isToday(day) ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500'}`}>
                {format(day, 'EEE')}<br />
                <span className={isToday(day) ? 'text-2xl font-bold' : 'text-lg'}>{format(day, 'd')}</span>
              </div>
              <div className="p-2 space-y-1 max-h-[150px] overflow-y-auto">
                {dayAppointments(day).map(appt => (
                  <div key={appt.id} className={`p-2 rounded text-xs ${statusColors[appt.status]} cursor-pointer hover:opacity-80`} onClick={() => { setEditingAppointment(appt); setShowModal(true); setAppointmentData(appt); }}>
                    <p className="font-medium truncate">{format(new Date(appt.scheduled_date), 'HH:mm')} - {appt.patient_first} {appt.patient_last}</p>
                    <p className="truncate">{appt.appointment_type}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="p-3 text-center text-sm font-medium text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getMonthDays(currentDate).map(day => (
              <div key={day.toISOString()} className={`border-r border-b min-h-[120px] p-2 ${!isSameDay(day, new Date()) && format(day, 'M') !== format(currentDate, 'M') ? 'bg-gray-50' : ''} ${isToday(day) ? 'bg-blue-50' : ''}`}>
                <div className={`text-right mb-1 ${isToday(day) ? 'text-blue-600 font-bold' : format(day, 'M') !== format(currentDate, 'M') ? 'text-gray-400' : 'text-gray-600'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayAppointments(day).slice(0, 3).map(appt => (
                    <div key={appt.id} className={`p-1 rounded text-xs ${statusColors[appt.status]} truncate`}>
                      {format(new Date(appt.scheduled_date), 'HH:mm')} {appt.patient_first?.charAt(0)}. {appt.patient_last}
                    </div>
                  ))}
                  {dayAppointments(day).length > 3 && (
                    <div className="text-xs text-gray-500 text-center">+{dayAppointments(day).length - 3} more</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {appointments?.map(appt => (
                <tr key={appt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{format(new Date(appt.scheduled_date), 'MMM dd, yyyy HH:mm')}</p>
                    <p className="text-sm text-gray-500">{appt.duration_minutes} min</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{appt.patient_first} {appt.patient_last}</p>
                    <p className="text-sm text-gray-500">{appt.patient_global_id}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">Dr. {appt.doctor_last}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[appt.appointment_type] || 'bg-gray-100 text-gray-800'}`}>
                      {appt.appointment_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{appt.duration_minutes} min</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[appt.status] || 'bg-gray-100 text-gray-800'}`}>
                      {appt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingAppointment(appt); setShowModal(true); setAppointmentData(appt); }} className="text-blue-600 hover:text-blue-900 text-sm font-medium">Edit</button>
                      <select value={appt.status} onChange={e => statusMutation.mutate({ id: appt.id, status: e.target.value })} className="text-xs border rounded px-2 py-1 bg-white">
                        {Object.keys(statusColors).map(s => <option key={s} value={s} selected={appt.status === s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {(!appointments || appointments.length === 0) && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No appointments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingAppointment ? 'Edit Appointment' : 'New Appointment'}</h2>
              <button onClick={() => { setShowModal(false); setEditingAppointment(null); resetForm(); }} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (editingAppointment) updateMutation.mutate({ id: editingAppointment.id, data: {...appointmentData, scheduled_date: new Date(appointmentData.scheduled_date).toISOString().slice(0,19).replace('T',' ') }}); else createMutation.mutate({...appointmentData, scheduled_date: new Date(appointmentData.scheduled_date).toISOString().slice(0,19).replace('T',' ') }); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  <select required value={appointmentData.patient_id} onChange={e => setAppointmentData({...appointmentData, patient_id: e.target.value})} className="input">
                    <option value="">Select Patient</option>
                    {patients?.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.global_id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
                  <select required value={appointmentData.doctor_id} onChange={e => setAppointmentData({...appointmentData, doctor_id: e.target.value})} className="input">
                    <option value="">Select Doctor</option>
                    {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.last_name} ({d.department})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                  <input type="datetime-local" required value={appointmentData.scheduled_date} onChange={e => setAppointmentData({...appointmentData, scheduled_date: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <input type="number" value={appointmentData.duration_minutes} onChange={e => setAppointmentData({...appointmentData, duration_minutes: parseInt(e.target.value)})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select required value={appointmentData.appointment_type} onChange={e => setAppointmentData({...appointmentData, appointment_type: e.target.value})} className="input">
                    <option value="Consultation">Consultation</option>
                    <option value="FollowUp">Follow-Up</option>
                    <option value="Procedure">Procedure</option>
                    <option value="Checkup">Checkup</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={appointmentData.notes} onChange={e => setAppointmentData({...appointmentData, notes: e.target.value})} rows={3} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowModal(false); setEditingAppointment(null); resetForm(); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} {editingAppointment ? 'Update' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}