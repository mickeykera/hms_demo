import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService, patientService } from '../services/api';
import { 
  Plus, Search, Eye, Edit, DollarSign, CreditCard, 
  FileText, AlertCircle, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  Unpaid: 'bg-red-100 text-red-800',
  Partial: 'bg-yellow-100 text-yellow-800',
  Paid: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-100 text-gray-800',
};

export default function Billing() {
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceData, setInvoiceData] = useState({ patient_id: '', visit_id: '', total_amount: '', insurance_applicable: false });
  const [paymentAmount, setPaymentAmount] = useState('');
  const queryClient = useQueryClient();

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientService.get(patientId).then(r => r.data.patient),
    enabled: !!patientId,
  });

  const { data: billingData } = useQuery({
    queryKey: ['billing', patientId],
    queryFn: () => billingService.getInvoices(patientId).then(r => r.data),
    enabled: !!patientId,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['patientSearch', search],
    queryFn: () => patientService.search(search).then(r => r.data.patients || []),
    enabled: !!search,
  });

  const invoiceMutation = useMutation({
    mutationFn: billingService.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', patientId] });
      setShowInvoiceModal(false);
      setInvoiceData({ patient_id: '', visit_id: '', total_amount: '', insurance_applicable: false });
    }
  });

  const paymentMutation = useMutation({
    mutationFn: () => billingService.pay(selectedInvoice.id, parseFloat(paymentAmount)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', patientId] });
      setShowPaymentModal(false);
      setPaymentAmount('');
    }
  });

  if (!patientId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-600">Invoice management and payment processing</p>
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
                <DollarSign className="w-5 h-5 text-green-600" />
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
          <h1 className="text-2xl font-bold text-gray-900">Billing - {patient?.first_name} {patient?.last_name}</h1>
          <p className="text-gray-600">{patient?.global_id} • Outstanding: ${billingData?.total_unpaid || 0}</p>
        </div>
        <button onClick={() => { setInvoiceData({...invoiceData, patient_id: patientId }); setShowInvoiceModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> New Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Invoices</p>
          <p className="text-3xl font-bold text-gray-900">{billingData?.invoices?.length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Unpaid Amount</p>
          <p className="text-3xl font-bold text-red-600">${(billingData?.total_unpaid || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Paid Invoices</p>
          <p className="text-3xl font-bold text-green-600">{billingData?.invoices?.filter(i => i.status === 'Paid').length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Pending Invoices</p>
          <p className="text-3xl font-bold text-yellow-600">{billingData?.invoices?.filter(i => i.status === 'Partial').length || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {billingData?.invoices?.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(inv.created_at), 'MMM dd, yyyy')}</td>
                <td className="px-6 py-4 text-sm text-gray-900">${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">${parseFloat(inv.paid_amount).toFixed(2)}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">${parseFloat(inv.balance).toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[inv.status] || 'bg-gray-100 text-gray-800'}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${inv.insurance_applicable ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {inv.insurance_applicable ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {inv.status !== 'Paid' && (
                      <button 
                        onClick={() => { setSelectedInvoice(inv); setShowPaymentModal(true); }}
                        className="text-green-600 hover:text-green-900 text-sm font-medium"
                      >
                        <CreditCard className="w-4 h-4 inline mr-1" /> Pay
                      </button>
                    )}
                    <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                      <Eye className="w-4 h-4 inline mr-1" /> View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!billingData?.invoices || billingData.invoices.length === 0) && (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Create Invoice</h2>
              <button onClick={() => setShowInvoiceModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); invoiceMutation.mutate({...invoiceData, total_amount: parseFloat(invoiceData.total_amount) }); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount *</label>
                <input type="number" step="0.01" required value={invoiceData.total_amount} onChange={e => setInvoiceData({...invoiceData, total_amount: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit ID (optional)</label>
                <input type="number" value={invoiceData.visit_id} onChange={e => setInvoiceData({...invoiceData, visit_id: e.target.value})} className="input" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="insurance" checked={invoiceData.insurance_applicable} onChange={e => setInvoiceData({...invoiceData, insurance_applicable: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="insurance" className="text-sm text-gray-700">Insurance Applicable</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowInvoiceModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={invoiceMutation.isPending} className="btn-primary">
                  {invoiceMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Process Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Invoice: {selectedInvoice.invoice_number}</p>
                <p className="text-sm text-gray-600">Total: ${parseFloat(selectedInvoice.total_amount).toFixed(2)}</p>
                <p className="text-sm text-gray-600">Paid: ${parseFloat(selectedInvoice.paid_amount).toFixed(2)}</p>
                <p className="text-sm font-medium text-gray-900">Balance: ${parseFloat(selectedInvoice.balance).toFixed(2)}</p>
              </div>
              <form onSubmit={e => { e.preventDefault(); paymentMutation.mutate(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount *</label>
                  <input type="number" step="0.01" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="input" max={selectedInvoice.balance} />
                  <p className="text-xs text-gray-500 mt-1">Max: ${parseFloat(selectedInvoice.balance).toFixed(2)}</p>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={paymentMutation.isPending} className="btn-primary bg-green-600 hover:bg-green-700">
                    {paymentMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Process
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}