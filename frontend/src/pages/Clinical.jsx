import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalService, patientService } from '../services/api';
import { 
  Plus, Search, Eye, Edit, FileText, Pill, 
  Stethoscope, AlertCircle, Loader2, HeartPulse,
  Activity, Brain, Bone, HelpCircle, Heart
} from 'lucide-react';
import { format } from 'date-fns';

const tabs = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'consultations', label: 'Consultations', icon: Stethoscope },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'history', label: 'Medical History', icon: HeartPulse },
];

export default function Clinical() {
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [consultData, setConsultData] = useState({ visit_id: '', chief_complaint: '', diagnosis: '', treatment_plan: '', notes: '' });
  const [prescriptionData, setPrescriptionData] = useState({ consultation_id: '', medication_name: '', dosage: '', frequency: '', duration_days: '', instructions: '' });
  const [historyData, setHistoryData] = useState({ condition: '', diagnosis_date: '', treatment: '', status: 'Active', notes: '' });
  const queryClient = useQueryClient();

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => clinicalService.getPatient(patientId).then(r => r.data.patient),
    enabled: !!patientId,
  });

  const { data: emr } = useQuery({
    queryKey: ['emr', patientId],
    queryFn: () => clinicalService.getEMR(patientId).then(r => r.data),
    enabled: !!patientId,
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['prescriptions', patientId],
    queryFn: () => clinicalService.getPrescriptions(patientId).then(r => r.data.prescriptions || []),
    enabled: !!patientId,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['patientSearch', search],
    queryFn: () => patientService.search(search).then(r => r.data.patients || []),
    enabled: !!search,
  });

  const consultMutation = useMutation({
    mutationFn: clinicalService.consult,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emr', patientId] });
      queryClient.invalidateQueries({ queryKey: ['consultations', patientId] });
      setShowConsultModal(false);
      setConsultData({ visit_id: '', chief_complaint: '', diagnosis: '', treatment_plan: '', notes: '' });
    }
  });

  const prescriptionMutation = useMutation({
    mutationFn: (data) => clinicalService.addPrescription(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions', patientId] });
      queryClient.invalidateQueries({ queryKey: ['emr', patientId] });
      setShowPrescriptionModal(false);
      setPrescriptionData({ consultation_id: '', medication_name: '', dosage: '', frequency: '', duration_days: '', instructions: '' });
    }
  });

  const historyMutation = useMutation({
    mutationFn: (data) => clinicalService.addHistory(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emr', patientId] });
    }
  });

  if (!patientId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical</h1>
          <p className="text-gray-600">Patient consultations, prescriptions, and medical records</p>
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
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
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
          <h1 className="text-2xl font-bold text-gray-900">Clinical - {patient?.first_name} {patient?.last_name}</h1>
          <p className="text-gray-600">{patient?.global_id} • DOB: {patient?.date_of_birth} • {patient?.gender}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowConsultModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> New Consultation
          </button>
          <button onClick={() => setShowPrescriptionModal(true)} className="btn-primary bg-purple-600 hover:bg-purple-700">
            <Pill className="w-4 h-4 mr-2" /> New Prescription
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <nav className="flex border-b" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && emr && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Consultations</h3>
              {emr.consultations?.length ? (
                <div className="space-y-4">
                  {emr.consultations.slice(0, 5).map(c => (
                    <div key={c.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{c.chief_complaint}</p>
                          <p className="text-sm text-gray-500">{format(new Date(c.consultation_date), 'MMM dd, yyyy HH:mm')}</p>
                          {c.diagnosis && <p className="text-sm text-gray-700 mt-1">Dx: {c.diagnosis}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No consultations yet</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Medical History</h3>
              {emr.medical_history?.length ? (
                <div className="space-y-3">
                  {emr.medical_history.slice(0, 5).map(h => (
                    <div key={h.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">{h.condition}</p>
                      <p className="text-sm text-gray-500">{h.diagnosis_date ? format(new Date(h.diagnosis_date), 'MMM dd, yyyy') : 'No date'} • {h.status || 'Active'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No medical history</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Active Prescriptions</h3>
              {prescriptions?.length ? (
                <div className="space-y-3">
                  {prescriptions.slice(0, 5).map(p => (
                    <div key={p.id} className="p-3 border rounded-lg">
                      <p className="font-medium">{p.medication_name}</p>
                      <p className="text-sm text-gray-500">{p.dosage} • {p.frequency}</p>
                      <p className="text-xs text-gray-400">{p.instructions || 'No instructions'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No active prescriptions</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Patient Info</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Global ID</dt><dd className="font-medium">{patient?.global_id}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Age</dt><dd className="font-medium">{patient?.date_of_birth ? Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Gender</dt><dd className="font-medium">{patient?.gender}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Blood Type</dt><dd className="font-medium">{patient?.blood_type || 'Unknown'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd className="font-medium">{patient?.phone}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Insurance</dt><dd className="font-medium">{patient?.insurance_provider || 'None'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'consultations' && emr && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chief Complaint</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diagnosis</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Treatment Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {emr.consultations?.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{format(new Date(c.consultation_date), 'MMM dd, yyyy HH:mm')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.chief_complaint}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.diagnosis || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{c.treatment_plan || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Dr. {c.doctor_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'prescriptions' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {prescriptions?.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.medication_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{p.dosage}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{p.frequency}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{p.duration_days ? `${p.duration_days} days` : '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{p.instructions || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(p.created_at), 'MMM dd, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && emr && (
        <div className="space-y-4">
          <button onClick={() => { setShowHistoryModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> Add History Entry
          </button>
          {emr.medical_history?.map(h => (
            <div key={h.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-lg">{h.condition}</p>
                  <p className="text-sm text-gray-500">{h.diagnosis_date ? format(new Date(h.diagnosis_date), 'MMM dd, yyyy') : 'No date'} • Status: {h.status || 'Active'}</p>
                  {h.treatment && <p className="text-sm text-gray-700 mt-1">Treatment: {h.treatment}</p>}
                  {h.notes && <p className="text-sm text-gray-600 mt-1">{h.notes}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showConsultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">New Consultation</h2>
              <button onClick={() => setShowConsultModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); consultMutation.mutate({...consultData, patient_id: patientId, doctor_id: 1 }); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint *</label>
                  <textarea required value={consultData.chief_complaint} onChange={e => setConsultData({...consultData, chief_complaint: e.target.value})} rows={3} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                  <input value={consultData.diagnosis} onChange={e => setConsultData({...consultData, diagnosis: e.target.value})} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Plan</label>
                  <textarea value={consultData.treatment_plan} onChange={e => setConsultData({...consultData, treatment_plan: e.target.value})} rows={3} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={consultData.notes} onChange={e => setConsultData({...consultData, notes: e.target.value})} rows={2} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowConsultModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={consultMutation.isPending} className="btn-primary">
                  {consultMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">New Prescription</h2>
              <button onClick={() => setShowPrescriptionModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); prescriptionMutation.mutate(prescriptionData); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medication *</label>
                  <input required value={prescriptionData.medication_name} onChange={e => setPrescriptionData({...prescriptionData, medication_name: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage *</label>
                  <input required value={prescriptionData.dosage} onChange={e => setPrescriptionData({...prescriptionData, dosage: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                  <input required value={prescriptionData.frequency} onChange={e => setPrescriptionData({...prescriptionData, frequency: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                  <input type="number" value={prescriptionData.duration_days} onChange={e => setPrescriptionData({...prescriptionData, duration_days: e.target.value})} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                  <textarea value={prescriptionData.instructions} onChange={e => setPrescriptionData({...prescriptionData, instructions: e.target.value})} rows={2} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowPrescriptionModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={prescriptionMutation.isPending} className="btn-primary bg-purple-600 hover:bg-purple-700">
                  {prescriptionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Add Medical History</h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); historyMutation.mutate(historyData); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                <input required value={historyData.condition} onChange={e => setHistoryData({...historyData, condition: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Date</label>
                <input type="date" value={historyData.diagnosis_date} onChange={e => setHistoryData({...historyData, diagnosis_date: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
                <input value={historyData.treatment} onChange={e => setHistoryData({...historyData, treatment: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <input value={historyData.status} onChange={e => setHistoryData({...historyData, status: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={historyData.notes} onChange={e => setHistoryData({...historyData, notes: e.target.value})} rows={2} className="input" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowHistoryModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}