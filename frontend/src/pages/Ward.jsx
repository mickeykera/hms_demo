import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wardService, patientService } from '../services/api';
import { 
  Plus, Search, Eye, Bed, UserPlus, 
  AlertCircle, Loader2, Download, Home, 
  UserCheck, UserMinus, Stethoscope, HeartPulse,
  ClipboardList, Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export default function Ward() {
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [admitData, setAdmitData] = useState({ patient_id: '', bed_id: '', reason: '' });
  const [noteData, setNoteData] = useState({ note_text: '', vital_signs: '' });
  const [activeTab, setActiveTab] = useState('admissions');
  const queryClient = useQueryClient();

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientService.get(patientId).then(r => r.data.patient),
    enabled: !!patientId,
  });

  const { data: admissionData } = useQuery({
    queryKey: ['admission', patientId],
    queryFn: () => wardService.getAdmission(patientId).then(r => r.data),
    enabled: !!patientId,
  });

  const { data: beds } = useQuery({
    queryKey: ['beds'],
    queryFn: () => wardService.getBeds().then(r => r.data.available_beds || []),
  });

  const { data: searchResults } = useQuery({
    queryKey: ['patientSearch', search],
    queryFn: () => patientService.search(search).then(r => r.data.patients || []),
    enabled: !!search,
  });

  const admitMutation = useMutation({
    mutationFn: wardService.admit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission', patientId] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      setShowAdmitModal(false);
      setAdmitData({ patient_id: '', bed_id: '', reason: '' });
    }
  });

  const dischargeMutation = useMutation({
    mutationFn: () => wardService.discharge(patientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission', patientId] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
    }
  });

  const noteMutation = useMutation({
    mutationFn: () => wardService.addNote(selectedAdmission.id, noteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission', patientId] });
      setShowNoteModal(false);
      setNoteData({ note_text: '', vital_signs: '' });
    }
  });

  if (!patientId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ward Management</h1>
          <p className="text-gray-600">Patient admissions, bed management, and nursing notes</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Select Patient</h2>
          <input
            type="text"
            placeholder="Search by name, ID, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input mb-4"
          />
          {search && searchResults?.map(p => (
            <button 
              key={p.id} 
              onClick={() => setPatientId(p.id)}
              className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Bed className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">{p.first_name} {p.last_name}</p>
                <p className="text-sm text-gray-500">{p.global_id} • {p.phone}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ward - {patient?.first_name} {patient?.last_name}</h1>
          <p className="text-gray-600">{patient?.global_id}</p>
        </div>
        <div className="flex gap-2">
          {admissionData?.active_admission ? (
            <button onClick={() => dischargeMutation.mutate()} className="btn-secondary bg-red-600 hover:bg-red-700 text-white">
              <UserMinus className="w-4 h-4 mr-2" /> Discharge
            </button>
          ) : (
            <button onClick={() => { setAdmitData({...admitData, patient_id: patientId }); setShowAdmitModal(true); }} className="btn-primary">
              <UserPlus className="w-4 h-4 mr-2" /> Admit Patient
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <nav className="flex border-b" aria-label="Tabs">
          {['admissions', 'beds', 'nursing'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'admissions' && (
        <div className="space-y-6">
          {admissionData?.active_admission ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b bg-green-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">Active Admission</h3>
                    <p className="text-sm text-green-600">Admitted: {format(new Date(admissionData.active_admission.admission_date), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Admitted</span>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Bed Information</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-gray-500">Ward</dt><dd className="font-medium">{admissionData.active_admission.bed?.ward || 'N/A'}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Bed</dt><dd className="font-medium">{admissionData.active_admission.bed?.bed_number || 'N/A'}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Type</dt><dd className="font-medium">{admissionData.active_admission.bed?.bed_type || 'N/A'}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Reason</dt><dd className="font-medium">{admissionData.active_admission.reason}</dd></div>
                  </dl>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Nursing Notes</h4>
                  {admissionData.nursing_notes?.length ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {admissionData.nursing_notes.slice(0, 5).map(note => (
                        <div key={note.id} className="p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm text-gray-700">{note.note_text}</p>
                          <p className="text-xs text-gray-500 mt-1">{format(new Date(note.note_time), 'MMM dd, HH:mm')} - Nurse {note.nurse_id}</p>
                          {note.vital_signs && <p className="text-xs text-gray-600 mt-1">Vitals: {note.vital_signs}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm py-4">No nursing notes yet</p>
                  )}
                  <button onClick={() => { setSelectedAdmission(admissionData.active_admission); setShowNoteModal(true); }} className="btn-secondary text-sm mt-4 w-full">
                    <ClipboardList className="w-4 h-4 mr-2" /> Add Note
                  </button>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Admission History</h4>
                  {admissionData.admissions?.map(adm => (
                    <div key={adm.id} className="p-3 bg-gray-50 rounded-lg mb-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{format(new Date(adm.admission_date), 'MMM dd, yyyy')}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${adm.status === 'Admitted' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {adm.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{adm.reason}</p>
                      {adm.discharge_date && <p className="text-xs text-gray-500">Discharged: {format(new Date(adm.discharge_date), 'MMM dd, yyyy')}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Bed className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Admission</h3>
              <p className="text-gray-500 mb-6">This patient is not currently admitted to any ward.</p>
              <button onClick={() => { setAdmitData({...admitData, patient_id: patientId }); setShowAdmitModal(true); }} className="btn-primary">
                <UserPlus className="w-4 h-4 mr-2" /> Admit Patient
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'beds' && beds && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Bed Management</h2>
            <div className="flex gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Available: {beds.filter(b => b.status === 'Available').length}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> Occupied: {beds.filter(b => b.status === 'Occupied').length}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500" /> Reserved: {beds.filter(b => b.status === 'Reserved').length}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500" /> Maintenance: {beds.filter(b => b.status === 'Maintenance').length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ward</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {beds.map(bed => (
                  <tr key={bed.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{bed.ward_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{bed.bed_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{bed.bed_type}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${bed.status === 'Available' ? 'bg-green-100 text-green-800' : bed.status === 'Occupied' ? 'bg-red-100 text-red-800' : bed.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                        {bed.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{bed.patient_id ? `Patient ${bed.patient_id}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'nursing' && admissionData?.active_admission && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Add Nursing Note</h2>
            <button onClick={() => { setSelectedAdmission(admissionData.active_admission); setShowNoteModal(true); }} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" /> New Note
            </button>
          </div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="font-semibold">Recent Notes</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {admissionData.nursing_notes?.map(note => (
                <div key={note.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-500">{format(new Date(note.note_time), 'MMM dd, yyyy HH:mm')}</span>
                    <span className="text-xs text-gray-400">Nurse #{note.nurse_id}</span>
                  </div>
                  <p className="text-gray-900 mb-2">{note.note_text}</p>
                  {note.vital_signs && <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded"><strong>Vitals:</strong> {note.vital_signs}</p>}
                </div>
              ))}
              {(!admissionData.nursing_notes || admissionData.nursing_notes.length === 0) && (
                <div className="p-12 text-center text-gray-500">No nursing notes yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Admit Patient</h2>
              <button onClick={() => setShowAdmitModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); admitMutation.mutate({...admitData, patient_id: patientId }); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bed *</label>
                <select required value={admitData.bed_id} onChange={e => setAdmitData({...admitData, bed_id: e.target.value})} className="input">
                  <option value="">Select Available Bed</option>
                  {beds?.filter(b => b.status === 'Available').map(b => (
                    <option key={b.id} value={b.id}>{b.ward_name} - {b.bed_number} ({b.bed_type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea required value={admitData.reason} onChange={e => setAdmitData({...admitData, reason: e.target.value})} rows={3} className="input" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowAdmitModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={admitMutation.isPending} className="btn-primary bg-green-600 hover:bg-green-700">
                  {admitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Admit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNoteModal && selectedAdmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Add Nursing Note</h2>
              <button onClick={() => setShowNoteModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); noteMutation.mutate(); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note *</label>
                <textarea required value={noteData.note_text} onChange={e => setNoteData({...noteData, note_text: e.target.value})} rows={4} className="input" placeholder="Enter nursing observations..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vital Signs</label>
                <input value={noteData.vital_signs} onChange={e => setNoteData({...noteData, vital_signs: e.target.value})} className="input" placeholder="BP: 120/80, HR: 72, Temp: 98.6F, SpO2: 99%" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowNoteModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={noteMutation.isPending} className="btn-primary bg-green-600 hover:bg-green-700">
                  {noteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}