import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyService, clinicalService } from '../services/api';
import { 
  Plus, Search, Eye, Pill, Package, AlertTriangle, 
  Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Download, Trash2, Edit, Clock, AlertCircle as AlertCircleIcon
} from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';

const statusColors = {
  low: 'bg-red-100 text-red-800',
  expiring: 'bg-yellow-100 text-yellow-800',
  normal: 'bg-green-100 text-green-800',
};

export default function Pharmacy() {
  const [activeTab, setActiveTab] = useState('medications');
  const [showMedModal, setShowMedModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [medData, setMedData] = useState({ name: '', generic_name: '', strength: '', form: '', manufacturer: '', unit_price: '', requires_prescription: true, controlled_substance: false, description: '' });
  const [invData, setInvData] = useState({ medication_id: '', batch_number: '', quantity: '', expiry_date: '', location: '', unit_cost: '' });
  const [dispenseData, setDispenseData] = useState({ prescription_id: '', medication_id: '', quantity: '', instructions: '', dispensed_by: 1 });
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const queryClient = useQueryClient();

  const { data: medications } = useQuery({
    queryKey: ['medications'],
    queryFn: () => pharmacyService.getMedications().then(r => r.data.medications || []),
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => pharmacyService.getInventory().then(r => r.data.inventory || []),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['lowStock'],
    queryFn: () => pharmacyService.lowStock(10).then(r => r.data.low_stock || []),
  });

  const { data: expiring } = useQuery({
    queryKey: ['expiring'],
    queryFn: () => pharmacyService.expiring(30).then(r => r.data.expiring_soon || []),
  });

  const medMutation = useMutation({
    mutationFn: (data) => editingMed ? pharmacyService.updateMedication(editingMed.id, data) : pharmacyService.createMedication(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['medications'] }); setShowMedModal(false); setEditingMed(null); resetMedForm(); }
  });

  const invMutation = useMutation({
    mutationFn: pharmacyService.addInventory,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); setShowInvModal(false); resetInvForm(); }
  });

  const dispenseMutation = useMutation({
    mutationFn: pharmacyService.dispense,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); setShowDispenseModal(false); resetDispenseForm(); }
  });

  const resetMedForm = () => { setMedData({ name: '', generic_name: '', strength: '', form: '', manufacturer: '', unit_price: '', requires_prescription: true, controlled_substance: false, description: '' }); setEditingMed(null); };
  const resetInvForm = () => setInvData({ medication_id: '', batch_number: '', quantity: '', expiry_date: '', location: '', unit_cost: '' });
  const resetDispenseForm = () => { setDispenseData({ prescription_id: '', medication_id: '', quantity: '', instructions: '', dispensed_by: 1 }); setSelectedPrescription(null); };

  const forms = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Patch', 'Other'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy</h1>
          <p className="text-gray-600">Medication management, inventory, and dispensing</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'medications' && <button onClick={() => setShowMedModal(true)} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Add Medication</button>}
          {activeTab === 'inventory' && <button onClick={() => setShowInvModal(true)} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Add Stock</button>}
          {activeTab === 'dispensing' && <button onClick={() => setShowDispenseModal(true)} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Dispense</button>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <nav className="flex border-b" aria-label="Tabs">
          {['medications', 'inventory', 'dispensing', 'alerts'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'medications' && medications && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <input type="text" placeholder="Search medications..." className="input w-64" />
            <button onClick={() => setShowMedModal(true)} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Add Medication</button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Generic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strength</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Form</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manufacturer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rx</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Controlled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {medications.map(med => (
                  <tr key={med.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{med.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{med.generic_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{med.strength || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">{med.form || 'Tablet'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{med.manufacturer || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">${parseFloat(med.unit_price || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      {med.requires_prescription ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-red-500 mx-auto" />}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {med.controlled_substance ? <AlertCircleIcon className="w-5 h-5 text-red-500 mx-auto" /> : <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => { setEditingMed(med); setMedData(med); setShowMedModal(true); }} className="text-blue-600 hover:text-blue-900 text-sm font-medium mr-3">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && inventory && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <input type="text" placeholder="Search inventory..." className="input w-64" />
            <button onClick={() => setShowInvModal(true)} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Add Stock</button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventory.map(item => {
                  const daysToExpiry = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                  const isLow = item.quantity <= 10;
                  const isExpiring = daysToExpiry <= 30 && daysToExpiry > 0;
                  const isExpired = daysToExpiry < 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{item.medication_name}</p>
                        <p className="text-sm text-gray-500">{item.strength} {item.form}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">{item.batch_number}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.quantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{format(new Date(item.expiry_date), 'MMM dd, yyyy')}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.location || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">${parseFloat(item.unit_cost || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${isExpired ? 'bg-red-100 text-red-800' : isExpiring ? 'bg-yellow-100 text-yellow-800' : isLow ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                          {isExpired ? 'EXPIRED' : isExpiring ? `Expires in ${daysToExpiry}d` : isLow ? 'LOW STOCK' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'dispensing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Dispense Medication</h2>
            <button onClick={() => setShowDispenseModal(true)} className="btn-primary mb-6"><Plus className="w-4 h-4 mr-2" /> New Dispensing</button>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Select a patient's pending prescription to dispense medication.</p>
              <p className="text-xs text-gray-400 mt-1">Patient prescriptions with pending dispense status will appear here after selecting a patient.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" /> Low Stock Alerts
                </h2>
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">{lowStock?.length || 0} items</span>
              </div>
              {lowStock?.map(item => (
                <div key={item.id} className="p-3 bg-red-50 rounded-lg border-l-4 border-red-500 mb-3">
                  <p className="font-medium text-red-800">{item.medication_name}</p>
                  <p className="text-sm text-red-600">Qty: {item.quantity} | Threshold: 10</p>
                </div>
              ))}
              {(!lowStock || lowStock.length === 0) && <p className="text-green-600 text-center py-4">All stock levels OK</p>}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" /> Expiring Soon
                </h2>
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">{expiring?.length || 0} items</span>
              </div>
              {expiring?.map(item => {
                const days = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={item.id} className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500 mb-3">
                    <p className="font-medium text-yellow-800">{item.medication_name}</p>
                    <p className="text-sm text-yellow-600">Batch: {item.batch_number} | Qty: {item.quantity} | Expires in {days} days ({format(new Date(item.expiry_date), 'MMM dd, yyyy')})</p>
                  </div>
                );
              })}
              {(!expiring || expiring.length === 0) && <p className="text-green-600 text-center py-4">No medications expiring soon</p>}
            </div>
          </div>
        </div>
      )}

      {showMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingMed ? 'Edit Medication' : 'Add Medication'}</h2>
              <button onClick={() => { setShowMedModal(false); setEditingMed(null); resetMedForm(); }} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); medMutation.mutate({...medData, unit_price: parseFloat(medData.unit_price) || null, requires_prescription: medData.requires_prescription, controlled_substance: medData.controlled_substance }); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input required value={medData.name} onChange={e => setMedData({...medData, name: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                  <input value={medData.generic_name} onChange={e => setMedData({...medData, generic_name: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                  <input value={medData.strength} onChange={e => setMedData({...medData, strength: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Form</label>
                  <select value={medData.form} onChange={e => setMedData({...medData, form: e.target.value})} className="input">
                    <option value="">Select</option>
                    {forms.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input value={medData.manufacturer} onChange={e => setMedData({...medData, manufacturer: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                  <input type="number" step="0.01" value={medData.unit_price} onChange={e => setMedData({...medData, unit_price: e.target.value})} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={medData.description} onChange={e => setMedData({...medData, description: e.target.value})} rows={2} className="input" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="rx" checked={medData.requires_prescription} onChange={e => setMedData({...medData, requires_prescription: e.target.checked})} className="w-4 h-4 text-purple-600 rounded" />
                  <label htmlFor="rx" className="text-sm">Requires Prescription</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="controlled" checked={medData.controlled_substance} onChange={e => setMedData({...medData, controlled_substance: e.target.checked})} className="w-4 h-4 text-purple-600 rounded" />
                  <label htmlFor="controlled" className="text-sm">Controlled Substance</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowMedModal(false); setEditingMed(null); resetMedForm(); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={medMutation.isPending} className="btn-primary bg-purple-600 hover:bg-purple-700">
                  {medMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} {editingMed ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Add Inventory Stock</h2>
              <button onClick={() => { setShowInvModal(false); resetInvForm(); }} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); invMutation.mutate({...invData, quantity: parseInt(invData.quantity), unit_cost: parseFloat(invData.unit_cost) || null }); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medication *</label>
                  <select required value={invData.medication_id} onChange={e => setInvData({...invData, medication_id: e.target.value})} className="input">
                    <option value="">Select Medication</option>
                    {medications?.map(m => <option key={m.id} value={m.id}>{m.name} ({m.strength} {m.form})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number *</label>
                  <input required value={invData.batch_number} onChange={e => setInvData({...invData, batch_number: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input type="number" required value={invData.quantity} onChange={e => setInvData({...invData, quantity: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                  <input type="date" required value={invData.expiry_date} onChange={e => setInvData({...invData, expiry_date: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input value={invData.location} onChange={e => setInvData({...invData, location: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
                  <input type="number" step="0.01" value={invData.unit_cost} onChange={e => setInvData({...invData, unit_cost: e.target.value})} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowInvModal(false); resetInvForm(); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={invMutation.isPending} className="btn-primary bg-purple-600 hover:bg-purple-700">
                  {invMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDispenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Dispense Medication</h2>
              <button onClick={() => { setShowDispenseModal(false); resetDispenseForm(); }} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); dispenseMutation.mutate({...dispenseData, quantity: parseInt(dispenseData.quantity) }); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prescription *</label>
                  <select required value={dispenseData.prescription_id} onChange={e => { setDispenseData({...dispenseData, prescription_id: e.target.value }); const p = selectedPrescription; }} className="input">
                    <option value="">Select Prescription</option>
                    {/* Would need patient prescriptions API */}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medication *</label>
                  <select required value={dispenseData.medication_id} onChange={e => setDispenseData({...dispenseData, medication_id: e.target.value})} className="input">
                    <option value="">Select Medication</option>
                    {medications?.map(m => <option key={m.id} value={m.id}>{m.name} ({m.strength} {m.form})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input type="number" required value={dispenseData.quantity} onChange={e => setDispenseData({...dispenseData, quantity: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dispensed By</label>
                  <input type="number" value={dispenseData.dispensed_by} onChange={e => setDispenseData({...dispenseData, dispensed_by: parseInt(e.target.value)})} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                  <textarea value={dispenseData.instructions} onChange={e => setDispenseData({...dispenseData, instructions: e.target.value})} rows={2} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowDispenseModal(false); resetDispenseForm(); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={dispenseMutation.isPending} className="btn-primary bg-purple-600 hover:bg-purple-700">
                  {dispenseMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Dispense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}