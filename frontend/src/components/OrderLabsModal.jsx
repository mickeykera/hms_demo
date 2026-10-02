import { useState, useEffect } from 'react';
import { X, FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { labService } from '../services/api';
import { useToast } from './Toast';

// Common panels offered as one-click options. `type` maps to the lab_tests
// test_type column; `sample` is the specimen the lab will expect.
const COMMON_TESTS = [
  { name: 'Complete Blood Count', type: 'Hematology', sample: 'EDTA Blood' },
  { name: 'Glucose', type: 'Chemistry', sample: 'Serum' },
  { name: 'Lipid Panel', type: 'Chemistry', sample: 'Serum' },
  { name: 'Liver Function Test', type: 'Chemistry', sample: 'Serum' },
  { name: 'Renal Function Test', type: 'Chemistry', sample: 'Serum' },
  { name: 'Urinalysis', type: 'Microbiology', sample: 'Urine' },
  { name: 'Blood Culture', type: 'Microbiology', sample: 'Blood Culture Bottle' },
  { name: 'Chest X-Ray', type: 'Radiology', sample: 'N/A' },
];

const emptyRow = () => ({ test_name: '', test_type: 'Chemistry', sample_id: '' });

export default function OrderLabsModal({ open, onClose, patients = [], defaultPatientId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([emptyRow()]);
  const [patientId, setPatientId] = useState(defaultPatientId || '');

  // Reset the form each time the modal opens so stale input never leaks
  // between patients.
  useEffect(() => {
    if (open) {
      setRows([emptyRow()]);
      setPatientId(defaultPatientId || '');
    }
  }, [open, defaultPatientId]);

  const orderMutation = useMutation({
    mutationFn: async () => {
      const pid = Number(patientId);
      // Orders are posted sequentially so a partial failure reports exactly
      // which test was rejected rather than failing the whole batch silently.
      const created = [];
      for (const row of rows) {
        const res = await labService.order({
          patient_id: pid,
          test_name: row.test_name,
          test_type: row.test_type,
          sample_id: row.sample_id,
        });
        created.push(res.data.test);
      }
      return created;
    },
    onSuccess: created => {
      // Refresh the doctor's pending worklist so new orders appear at once.
      queryClient.invalidateQueries({ queryKey: ['pending-lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast(
        created.length === 1
          ? 'Lab test ordered — lab notified'
          : `${created.length} lab tests ordered — lab notified`
      );
      onClose();
    },
    onError: err => {
      toast(err?.response?.data?.error || 'Failed to order lab test', 'error');
    },
  });

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape' && !orderMutation.isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // orderMutation is intentionally excluded: re-subscribing on every
    // mutation state change would churn the listener needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  if (!open) return null;

  const setRow = (i, patch) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const applyPreset = (i, preset) =>
    setRow(i, { test_name: preset.name, test_type: preset.type, sample_id: preset.sample });

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = i => setRows(prev => prev.filter((_, idx) => idx !== i));

  // A row is valid once it names a test and a specimen.
  const rowsValid = rows.every(r => r.test_name.trim() && r.sample_id.trim());
  const canSubmit = patientId && rowsValid && rows.length > 0 && !orderMutation.isPending;

  const handleSubmit = e => {
    e.preventDefault();
    if (!canSubmit) return;
    orderMutation.mutate();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !orderMutation.isPending && onClose()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-labs-title"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white rounded-t-lg">
          <h2 id="order-labs-title" className="text-xl font-semibold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-600" /> Order Lab Tests
          </h2>
          <button
            onClick={onClose}
            disabled={orderMutation.isPending}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            aria-label="Close order labs dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          <div>
            <label htmlFor="order-lab-patient" className="block text-sm font-medium text-gray-700 mb-1">
              Patient *
            </label>
            <select
              id="order-lab-patient"
              required
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                  {p.global_id ? ` (${p.global_id})` : ''}
                </option>
              ))}
            </select>
            {patients.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No patients assigned to you yet.</p>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="block text-sm font-medium text-gray-700">Tests *</span>
              <button
                type="button"
                onClick={addRow}
                disabled={orderMutation.isPending}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add another test
              </button>
            </div>

            {rows.map((row, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    list="lab-test-presets"
                    value={row.test_name}
                    onChange={e => setRow(i, { test_name: e.target.value })}
                    placeholder="Test name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={orderMutation.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                      aria-label={`Remove test ${i + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={row.test_type}
                    onChange={e => setRow(i, { test_type: e.target.value })}
                    placeholder="Category"
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    required
                    value={row.sample_id}
                    onChange={e => setRow(i, { sample_id: e.target.value })}
                    placeholder="Sample ID"
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {COMMON_TESTS.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(i, preset)}
                      disabled={orderMutation.isPending}
                      className="px-2 py-1 text-xs bg-white border border-gray-300 rounded-full hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-50"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <datalist id="lab-test-presets">
              {COMMON_TESTS.map(t => (
                <option key={t.name} value={t.name} />
              ))}
            </datalist>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={orderMutation.isPending}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {orderMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {orderMutation.isPending
                ? 'Ordering…'
                : rows.length > 1
                  ? `Order ${rows.length} Tests`
                  : 'Order Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}