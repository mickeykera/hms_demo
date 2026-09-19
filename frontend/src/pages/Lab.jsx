import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labService, patientService } from '../services/api';
import { 
  Plus, Search, Eye, Edit, FlaskConical, CheckCircle, 
  AlertCircle, Loader2, XCircle, Download, FileText, 
  ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  Ordered: 'bg-gray-100 text-gray-800',
  Collected: 'bg-blue-100 text-blue-800',
  Processing: 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export default function Lab() {
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [orderData, setOrderData] = useState({ patient_id: '', test_name: '', test_type: '', sample_id: '' });
  const [resultData, setResultData] = useState({ result_data: '', reference_range: '', flagged: false });
  const [activeTab, setActiveTab] = useState('tests');
  const queryClient = useQueryClient();

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientService.get(patientId).then(r => r.data.patient),
    enabled: !!patientId,
  });

  const { data: labData } = useQuery({
    queryKey: ['lab', patientId],
    queryFn: () => labService.getTests(patientId).then(r => r.data.tests || []),
    enabled: !!patientId,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['patientSearch', search],
    queryFn: () => patientService.search(search).then(r => r.data.patients || []),
    enabled: !!search,
  });

  const orderMutation = useMutation({
    mutationFn: labService.order,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab', patientId] });
      setShowOrderModal(false);
      setOrderData({ patient_id: '', test_name: '', test_type: '', sample_id: '' });
    }
  });

  const resultMutation = useMutation({
    mutationFn: () => labService.addResult(selectedTest.test.id, resultData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab', patientId] });
      setShowResultModal(false);
      setResultData({ result_data: '', reference_range: '', flagged: false });
    }
  });

  if (!patientId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratory</h1>
          <p className="text-gray-600">Lab test ordering and result management</p>
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
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-purple-600" />
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
          <h1 className="text-2xl font-bold text-gray-900">Laboratory - {patient?.first_name} {patient?.last_name}</h1>
          <p className="text-gray-600">{patient?.global_id}</p>
        </div>
        <button onClick={() => { setOrderData({...orderData, patient_id: patientId }); setShowOrderModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Order Test
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <nav className="flex border-b" aria-label="Tabs">
          {['tests', 'pending', 'completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'tests' && labData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Results</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {labData.map(({ test, results }) => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{test.test_name}</p></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{test.test_type || '-'}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-700">{test.sample_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(test.ordered_at), 'MMM dd, yyyy HH:mm')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[test.status] || 'bg-gray-100 text-gray-800'}`}>
                        {test.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{results?.length || 0} result(s)</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {test.status !== 'Completed' && (
                          <button 
                            onClick={() => { setSelectedTest({ test, results }); setShowResultModal(true); }}
                            className="text-purple-600 hover:text-purple-900 text-sm font-medium"
                          >
                            <CheckCircle className="w-4 h-4 inline mr-1" /> Enter Result
                          </button>
                        )}
                        {results?.length > 0 && (
                          <button 
                            onClick={() => setSelectedTest({ test, results })}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            <Eye className="w-4 h-4 inline mr-1" /> View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
              ))}
              {(!labData || labData.length === 0) && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No tests ordered</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'pending' && labData && (
        <div className="space-y-4">
          {labData.filter(({ test }) => test.status !== 'Completed' && test.status !== 'Cancelled').map(({ test, results }) => (
            <div key={test.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-lg">{test.test_name}</p>
                  <p className="text-sm text-gray-500">Sample: {test.sample_id} • Ordered: {format(new Date(test.ordered_at), 'MMM dd, yyyy HH:mm')}</p>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 ml-2">{test.status}</span>
                </div>
                <button 
                  onClick={() => { setSelectedTest({ test, results }); setShowResultModal(true); }}
                  className="btn-primary text-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> Enter Result
                </button>
              </div>
            </div>
          ))}
          {labData.filter(({ test }) => test.status !== 'Completed' && test.status !== 'Cancelled').length === 0 && (
            <p className="text-gray-500 text-center py-8">No pending tests</p>
          )}
        </div>
      )}

      {activeTab === 'completed' && labData && (
        <div className="space-y-4">
          {labData.filter(({ test }) => test.status === 'Completed').map(({ test, results }) => (
            <div key={test.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-lg">{test.test_name}</p>
                  <p className="text-sm text-gray-500">Completed: {test.completed_at ? format(new Date(test.completed_at), 'MMM dd, yyyy HH:mm') : 'N/A'}</p>
                </div>
                <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                  <Eye className="w-4 h-4 inline mr-1" /> View Results
                </button>
              </div>
              {results?.map(r => (
                <div key={r.id} className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{r.result_data}</p>
                  <p className="text-sm text-gray-500">Ref: {r.reference_range || 'N/A'} {r.flagged && <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">FLAGGED</span>}</p>
                </div>
              ))}
            </div>
          ))}
          {labData.filter(({ test }) => test.status === 'Completed').length === 0 && (
            <p className="text-gray-500 text-center py-8">No completed tests</p>
          )}
        </div>
      )}

      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Order Lab Test</h2>
              <button onClick={() => setShowOrderModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); orderMutation.mutate({...orderData, patient_id: patientId }); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name *</label>
                <input required value={orderData.test_name} onChange={e => setOrderData({...orderData, test_name: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                <input value={orderData.test_type} onChange={e => setOrderData({...orderData, test_type: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sample ID *</label>
                <input required value={orderData.sample_id} onChange={e => setOrderData({...orderData, sample_id: e.target.value})} className="input" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowOrderModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={orderMutation.isPending} className="btn-primary">
                  {orderMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResultModal && selectedTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Enter Result - {selectedTest.test.test_name}</h2>
              <button onClick={() => setShowResultModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); resultMutation.mutate(); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result Data *</label>
                <textarea required value={resultData.result_data} onChange={e => setResultData({...resultData, result_data: e.target.value})} rows={3} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Range</label>
                <input value={resultData.reference_range} onChange={e => setResultData({...resultData, reference_range: e.target.value})} className="input" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="flagged" checked={resultData.flagged} onChange={e => setResultData({...resultData, flagged: e.target.checked})} className="w-4 h-4 text-purple-600 rounded" />
                <label htmlFor="flagged" className="text-sm text-gray-700">Flag as abnormal</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowResultModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={resultMutation.isPending} className="btn-primary bg-purple-600 hover:bg-purple-700">
                  {resultMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Save Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}