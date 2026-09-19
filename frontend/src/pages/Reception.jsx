import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService, clinicalService } from '../services/api';
import { 
  Plus, Search, Edit, Eye, Calendar, UserPlus, 
  Stethoscope, AlertCircle, Loader2, MoreVertical,
  Download, Filter
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  Waiting: 'bg-yellow-100 text-yellow-800',
  InConsultation: 'bg-blue-100 text-blue-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export default function Reception() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', date_of_birth: '', gender: 'Male',
    blood_type: '', email: '', phone: '', address: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    insurance_provider: '', insurance_id: '', insurance_validity: ''
  });
  const queryClient = useQueryClient();

  const { data: patients } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientService.search(search).then(r => r.data.patients || []),
    enabled: !!search || search === '',
  });

  const { data: queue } = useQuery({
    queryKey: ['queue', 'General'],
    queryFn: () => patientService.queue('General').then(r => r.data.waiting_patients || []),
    refetchInterval: 30000,
  });

  const registerMutation = useMutation({
    mutationFn: patientService.register,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowModal(false);
      setFormData({ first_name: '', last_name: '', date_of_birth: '', gender: 'Male', blood_type: '', email: '', phone: '', address: '', emergency_contact_name: '', emergency_contact_phone: '', insurance_provider: '', insurance_id: '', insurance_validity: '' });
    }
  });

  const checkinMutation = useMutation({
    mutationFn: ({ globalId, data }) => patientService.checkin(globalId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] })
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingPatient) {
      // patientService.update(editingPatient.global_id, formData)
    } else {
      registerMutation.mutate(formData);
    }
  };

  const genders = ['Male', 'Female', 'Other', 'PreferNotToSay'];
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reception</h1>
          <p className="text-gray-600">Patient registration and queue management</p>
        </div>
        <button onClick={() => { setEditingPatient(null); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Register Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Waiting Queue - General</h2>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {queue?.length || 0} waiting
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {queue?.map((visit, i) => (
                    <tr key={visit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{visit.queue_position}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{visit.patient?.first_name} {visit.patient?.last_name}</div>
                        <div className="text-sm text-gray-500">ID: {visit.patient?.global_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${visit.triage_priority <= 2 ? 'bg-red-100 text-red-800' : visit.triage_priority === 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          P{visit.triage_priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {format(new Date(visit.check_in_time), 'HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">View</button>
                      </td>
                    </tr>
                  ))}
                  {(!queue || queue.length === 0) && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No patients waiting</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Search Patient</h2>
            <input
              type="text"
              placeholder="Search by name, ID, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {search && patients && patients.map(p => (
              <div key={p.id} className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{p.first_name} {p.last_name}</p>
                <p className="text-sm text-gray-500">{p.global_id} • {p.phone}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => patientService.checkin(p.global_id, {})} className="btn-primary text-sm flex-1">Check-in</button>
                  <button onClick={() => { setEditingPatient(p); setShowModal(true); setFormData(p); }} className="btn-secondary text-sm">Edit</button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Today's Registrations</span>
                <span className="font-medium">24</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Walk-ins</span>
                <span className="font-medium">18</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Scheduled</span>
                <span className="font-medium">6</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Wait Time</span>
                <span className="font-medium text-orange-600">12 min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingPatient ? 'Edit Patient' : 'Register New Patient'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <Download size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input type="date" required value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="input">
                    {genders.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                  <select value={formData.blood_type} onChange={e => setFormData({...formData, blood_type: e.target.value})} className="input">
                    <option value="">Select</option>
                    {bloodTypes.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Name" value={formData.emergency_contact_name} onChange={e => setFormData({...formData, emergency_contact_name: e.target.value})} className="input" />
                    <input type="tel" placeholder="Phone" value={formData.emergency_contact_phone} onChange={e => setFormData({...formData, emergency_contact_phone: e.target.value})} className="input" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurance</label>
                  <div className="grid grid-cols-3 gap-4">
                    <input type="text" placeholder="Provider" value={formData.insurance_provider} onChange={e => setFormData({...formData, insurance_provider: e.target.value})} className="input" />
                    <input type="text" placeholder="Policy ID" value={formData.insurance_id} onChange={e => setFormData({...formData, insurance_id: e.target.value})} className="input" />
                    <input type="date" value={formData.insurance_validity} onChange={e => setFormData({...formData, insurance_validity: e.target.value})} className="input" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={registerMutation.isPending} className="btn-primary">
                  {registerMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''}
                  {editingPatient ? 'Update' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary = 'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50';
const btnSecondary = 'bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition';
const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';