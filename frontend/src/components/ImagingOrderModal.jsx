import { useState, useEffect } from 'react';
import { X, Activity, Loader2, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useToast } from './Toast';

// Modality / body-part values used by the radiology module's own seeded data.
const MODALITIES = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound'];

const BODY_PARTS = [
  'Head', 'Chest', 'Abdomen', 'Pelvis',
  'Spine', 'Upper Limb', 'Lower Limb',
  'Knee', 'Wrist', 'Ankle', 'Shoulder', 'Hip',
];

// Sensible default body part per modality to cut down on clicks.
const DEFAULT_BODY_PART = {
  'X-Ray': 'Chest',
  'CT Scan': 'Head',
  MRI: 'Head',
  Ultrasound: 'Abdomen',
};

export default function ImagingOrderModal({ open, onClose, patients = [], defaultPatientId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState(defaultPatientId || '');
  const [modality, setModality] = useState(MODALITIES[0]);
  const [bodyPart, setBodyPart] = useState(DEFAULT_BODY_PART[MODALITIES[0]]);
  const [indication, setIndication] = useState('');

  useEffect(() => {
    if (!open) return;
    setPatientId(defaultPatientId || '');
    setModality(MODALITIES[0]);
    setBodyPart(DEFAULT_BODY_PART[MODALITIES[0]]);
    setIndication('');
  }, [open, defaultPatientId]);

  const orderMutation = useMutation({
    mutationFn: () =>
      api.post('/radiology/order', {
        patient_id: Number(patientId),
        modality,
        body_part: bodyPart,
        clinical_indication: indication || undefined,
      }),
    onSuccess: () => {
      // Refresh the doctor's pending-imaging worklist and the radiology queue.
      queryClient.invalidateQueries({ queryKey: ['pending-imaging'] });
      queryClient.invalidateQueries({ queryKey: ['radiology-queue'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast(`${modality} ordered — radiology notified`);
      onClose();
    },
    onError: err => {
      toast(err?.response?.data?.error || 'Failed to order imaging', 'error');
    },
  });

  const canSubmit = !!patientId && !!modality && !!bodyPart && !orderMutation.isPending;

  // Guard after every hook so hook order stays stable across renders.
  if (!open) return null;
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
        aria-labelledby="imaging-order-title"
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0">
          <div>
            <h2 id="imaging-order-title" className="text-xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-pink-600" /> Order Imaging
            </h2>
            <p className="text-sm text-gray-600">Schedules the study with the radiology department.</p>
          </div>
          <button
            onClick={onClose}
            disabled={orderMutation.isPending}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            aria-label="Close imaging order dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div>
            <label htmlFor="img-patient" className="block text-sm font-medium text-gray-700 mb-1">
              Patient *
            </label>
            <select
              id="img-patient"
              required
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
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

          <div>
            <label htmlFor="img-modality" className="block text-sm font-medium text-gray-700 mb-1">
              Modality *
            </label>
            <select
              id="img-modality"
              required
              value={modality}
              onChange={e => {
                setModality(e.target.value);
                setBodyPart(DEFAULT_BODY_PART[e.target.value] || BODY_PARTS[0]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              {MODALITIES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Body Part *</span>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {BODY_PARTS.map(bp => (
                <button
                  key={bp}
                  type="button"
                  onClick={() => setBodyPart(bp)}
                  disabled={orderMutation.isPending}
                  className={`px-2.5 py-1 text-xs rounded-full border transition disabled:opacity-50 ${
                    bodyPart === bp
                      ? 'bg-pink-600 text-white border-pink-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-pink-300'
                  }`}
                >
                  {bp}
                </button>
              ))}
            </div>
            {/* Keeps the field keyboard-accessible and screen-reader labelled
                while the chips above provide the fast path. */}
            <select
              value={bodyPart}
              onChange={e => setBodyPart(e.target.value)}
              aria-label="Body part"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              {BODY_PARTS.map(bp => (
                <option key={bp} value={bp}>{bp}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="img-indication" className="block text-sm font-medium text-gray-700 mb-1">
              Clinical Indication
            </label>
            <textarea
              id="img-indication"
              rows={3}
              value={indication}
              onChange={e => setIndication(e.target.value)}
              placeholder="Why this study is needed — e.g. rule out pneumonia"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional, but it is what the radiologist reads first.
            </p>
          </div>
        </div>

        <div className="border-t p-4 sm:px-6 flex justify-end gap-3 shrink-0 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={orderMutation.isPending}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => canSubmit && orderMutation.mutate()}
            disabled={!canSubmit}
            className="inline-flex items-center px-4 py-2 rounded-md bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {orderMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {orderMutation.isPending ? 'Ordering…' : 'Order Imaging'}
          </button>
        </div>
      </div>
    </div>
  );
}