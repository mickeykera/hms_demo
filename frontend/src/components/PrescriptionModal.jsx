import { useState, useEffect } from 'react';
import {
  X, Pill, Loader2, Send, Trash2, Plus, AlertTriangle,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clinicalService } from '../services/api';
import { api } from '../services/api';
import { useToast } from './Toast';

const FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every 6 hours',
  'Every 8 hours',
  'As needed (PRN)',
  'At bedtime',
  'With meals',
];

const emptyRow = () => ({
  medication_name: '',
  dosage: '',
  frequency: 'Once daily',
  duration_days: '7',
  instructions: '',
});

export default function PrescriptionModal({ open, onClose, patient, consultationId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([emptyRow()]);

  // Pharmacy drug catalog, so prescribing is autocomplete-driven rather than
  // free-text. Doctors already have read access to /pharmacy/medications.
  const { data: medications = [] } = useQuery({
    queryKey: ['pharmacy-medications'],
    queryFn: () => api.get('/pharmacy/medications').then(r => r.data.medications || []).catch(() => []),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (open) setRows([emptyRow()]);
  }, [open, patient?.id, consultationId]);

  const setRow = (i, patch) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = i => setRows(prev => prev.filter((_, idx) => idx !== i));

  const applyMedication = (i, medId) => {
    const med = medications.find(m => String(m.id) === String(medId));
    if (!med) return;
    setRow(i, {
      // Name carries strength so it reads correctly in the pharmacy queue.
      medication_name: `${med.name} ${med.strength || ''}`.trim(),
      dosage: `1 ${(med.form || 'tablet').toLowerCase()}`,
    });
  };

  // The API requires a consultation_id (NOT NULL + FK). When opened outside
  // an encounter, fall back to the patient's most recent consultation so a
  // prescription can still be issued, and block only if none exists.
  const { data: resolvedConsultationId, isLoading: resolvingConsult } = useQuery({
    queryKey: ['latest-consultation', patient?.id, consultationId],
    queryFn: async () => {
      if (consultationId) return consultationId;
      const res = await api
        .get(`/clinical/${patient.id}`)
        .then(r => r.data.consultations || [])
        .catch(() => []);
      return res[0]?.id ?? null;
    },
    enabled: open && !!patient?.id,
  });

  const effectiveConsultationId = consultationId ?? resolvedConsultationId;

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = [];
      for (const row of rows) {
        const res = await clinicalService.addPrescription(patient.id, {
          consultation_id: effectiveConsultationId,
          medication_name: row.medication_name,
          dosage: row.dosage,
          frequency: row.frequency,
          duration_days: row.duration_days ? parseInt(row.duration_days, 10) : undefined,
          instructions: row.instructions || undefined,
        });
        created.push(res.data);
      }
      return created;
    },
    onSuccess: created => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast(
        created.length === 1
          ? 'Prescription sent to pharmacy'
          : `${created.length} prescriptions sent to pharmacy`
      );
      onClose();
    },
    onError: err => {
      toast(err?.response?.data?.error || 'Failed to send prescription', 'error');
    },
  });

  const rowsValid = rows.every(r => r.medication_name.trim() && r.dosage.trim() && r.frequency);
  const canSubmit =
    rowsValid && rows.length > 0 && !createMutation.isPending && !!effectiveConsultationId;

  // Guard after every hook so hook order stays stable across renders.
  if (!open || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !createMutation.isPending && onClose()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-title"
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0">
          <div>
            <h2 id="rx-title" className="text-xl font-semibold flex items-center gap-2">
              <Pill className="w-5 h-5 text-green-600" /> New Prescription
            </h2>
            <p className="text-sm text-gray-600">
              {patient.first_name} {patient.last_name}
              {patient.global_id ? ` • ${patient.global_id}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={createMutation.isPending}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            aria-label="Close prescription dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!effectiveConsultationId && !resolvingConsult && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                A prescription must be linked to a consultation. This patient has no existing
                consultation — start an encounter first, then add the prescription.
              </p>
            </div>
          )}

          {resolvingConsult && (
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Finding the most recent encounter…
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="block text-sm font-medium text-gray-700">Medications *</span>
            <button
              type="button"
              onClick={addRow}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add another
            </button>
          </div>

          {rows.map((row, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  list="rx-medication-catalog"
                  value={row.medication_name}
                  onChange={e => setRow(i, { medication_name: e.target.value })}
                  placeholder="Medication (type or pick from catalog)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={createMutation.isPending}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                    aria-label={`Remove medication ${i + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {medications.length > 0 && (
                <select
                  value=""
                  onChange={e => applyMedication(i, e.target.value)}
                  disabled={createMutation.isPending}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Fill from drug catalog…</option>
                  {medications.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.strength} · {m.form}
                      {m.controlled_substance ? ' (controlled)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={row.dosage}
                  onChange={e => setRow(i, { dosage: e.target.value })}
                  placeholder="Dosage (e.g. 1 tablet)"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <select
                  required
                  value={row.frequency}
                  onChange={e => setRow(i, { frequency: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {FREQUENCIES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={row.duration_days}
                  onChange={e => setRow(i, { duration_days: e.target.value })}
                  placeholder="Days"
                  aria-label="Duration in days"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <textarea
                rows={2}
                value={row.instructions}
                onChange={e => setRow(i, { instructions: e.target.value })}
                placeholder="Instructions for the patient (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}

          <datalist id="rx-medication-catalog">
            {medications.map(m => (
              <option key={m.id} value={`${m.name} ${m.strength || ''}`.trim()}>
                {m.form}
              </option>
            ))}
          </datalist>
        </div>
        <div className="border-t p-4 sm:px-6 flex justify-end gap-3 shrink-0 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => canSubmit && createMutation.mutate()}
            disabled={!canSubmit}
            className="inline-flex items-center px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {createMutation.isPending
              ? 'Sending…'
              : rows.length > 1
                ? `Send ${rows.length} Prescriptions`
                : 'Send to Pharmacy'}
          </button>
        </div>
      </div>
    </div>
  );
}