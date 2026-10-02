import { useState, useEffect, useRef } from 'react';
import { X, Stethoscope, Loader2, Save, CheckCircle2, AlertCircle, Pill } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalService } from '../services/api';
import { useToast } from './Toast';
const SECTIONS = [
  { key: 'subjective', letter: 'S', label: 'Subjective', hint: 'Patient-reported history, symptoms, onset' },
  { key: 'objective', letter: 'O', label: 'Objective', hint: 'Exam findings, vitals, observed data' },
  { key: 'assessment', letter: 'A', label: 'Assessment', hint: 'Diagnosis and clinical impression' },
  { key: 'plan', letter: 'P', label: 'Plan', hint: 'Treatment, follow-up, patient advice' },
];

// Sections the server enforces before a note can be signed. Objective is
// intentionally excluded — "nothing abnormal on exam" is a valid note.
const REQUIRED_TO_SIGN = ['subjective', 'assessment', 'plan'];

const emptyForm = () => ({
  chief_complaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  diagnosis: '',
});

export default function SoapNoteModal({ open, onClose, patient, doctorId, onPrescribe }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [consultationId, setConsultationId] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const [visitId, setVisitId] = useState(null);
  const dirtyRef = useRef(false);

  // Reset whenever the modal opens for a different encounter.
  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setConsultationId(null);
    setSavedAt(null);
    setShowValidation(false);
    setVisitId(null);
    dirtyRef.current = false;
  }, [open, patient?.id]);

  // Warn before losing an unsaved note.
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (dirtyRef.current && !consultationId) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [open, consultationId]);

  const buildPayload = () => ({
    chief_complaint: form.chief_complaint || 'Not recorded',
    subjective: form.subjective,
    objective: form.objective,
    assessment: form.assessment,
    plan: form.plan,
    diagnosis: form.diagnosis,
  });

  // A consultation requires a visit_id. Resolve (or open) one when the modal
  // opens so the clinician never has to pick a visit from a dropdown.
  const visitMutation = useMutation({
    mutationFn: () => clinicalService.openVisit(patient.id),
    onSuccess: data => setVisitId(data.data.visit.id),
    onError: err => {
      toast(err?.response?.data?.error || 'Could not open a visit for this patient', 'error');
    },
  });

  useEffect(() => {
    if (open && patient?.id && !visitId) visitMutation.mutate();
  }, [open, patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create the consultation record on first save, then keep updating it.
  const saveMutation = useMutation({
    mutationFn: async () => {
      const visit = visitId ?? (await clinicalService.openVisit(patient.id)).data.visit.id;
      if (consultationId) {
        await clinicalService.saveSoapDraft(consultationId, buildPayload());
        return { id: consultationId };
      }
      const res = await clinicalService.startConsult({
        visit_id: visit,
        patient_id: patient.id,
        doctor_id: doctorId,
        ...buildPayload(),
      });
      return { id: res.data.consultation_id };
    },
    onSuccess: data => {
      setConsultationId(data.id);
      setSavedAt(new Date());
      dirtyRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['pending-consultations'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-consultations'] });
      toast('Draft saved');
    },
    onError: err => {
      toast(err?.response?.data?.error || 'Failed to save note', 'error');
    },
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      // Always persist current text before signing, otherwise a clinician who
      // typed and immediately clicked Sign would lose the last edit.
      let id = consultationId;
      if (id) {
        await clinicalService.saveSoapDraft(id, buildPayload());
      } else {
        const res = await clinicalService.startConsult({
          visit_id: visitId,
          patient_id: patient.id,
          doctor_id: doctorId,
          ...buildPayload(),
        });
        id = res.data.consultation_id;
        setConsultationId(id);
      }
      return clinicalService.signSoap(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-consultations'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-consultations'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-patients'] });
      toast('Encounter signed and finalized');
      onClose();
    },
    onError: err => {
      if (err?.response?.data?.missing_sections) setShowValidation(true);
      toast(err?.response?.data?.error || 'Failed to sign note', 'error');
    },
  });

  if (!open || !patient) return null;

  const set = (key, value) => {
    dirtyRef.current = true;
    setForm(f => ({ ...f, [key]: value }));
  };

  const missing = REQUIRED_TO_SIGN.filter(k => !form[k].trim());
  const busy = saveMutation.isPending || signMutation.isPending;
  const handleSign = () => {
    if (missing.length) {
      setShowValidation(true);
      return;
    }
    signMutation.mutate();
  };

  const handleSaveDraft = () => {
    setShowValidation(false);
    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="soap-title"
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0">
          <div>
            <h2 id="soap-title" className="text-xl font-semibold flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-blue-600" /> SOAP Note
            </h2>
            <p className="text-sm text-gray-600">
              {patient.first_name} {patient.last_name}
              {patient.global_id ? ` • ${patient.global_id}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            aria-label="Close SOAP note"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div>
            <label htmlFor="soap-cc" className="block text-sm font-medium text-gray-700 mb-1">
              Chief Complaint
            </label>
            <input
              id="soap-cc"
              type="text"
              value={form.chief_complaint}
              onChange={e => set('chief_complaint', e.target.value)}
              placeholder="e.g. Abdominal pain, 3 days"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {SECTIONS.map(s => {
            const invalid = showValidation && missing.includes(s.key);
            return (
              <div key={s.key}>
                <label
                  htmlFor={`soap-${s.key}`}
                  className="flex items-baseline gap-2 text-sm font-medium text-gray-700 mb-1"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                    {s.letter}
                  </span>
                  {s.label}
                  {REQUIRED_TO_SIGN.includes(s.key) && (
                    <span className="text-xs text-gray-400 font-normal">required to sign</span>
                  )}
                </label>
                <p className="text-xs text-gray-500 mb-1 ml-8">{s.hint}</p>
                <textarea
                  id={`soap-${s.key}`}
                  rows={3}
                  value={form[s.key]}
                  onChange={e => set(s.key, e.target.value)}
                  aria-invalid={invalid}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
                    invalid
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {invalid && (
                  <p className="mt-1 ml-8 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {s.label} is required before signing
                  </p>
                )}
              </div>
            );
          })}

          <div>
            <label htmlFor="soap-diagnosis" className="block text-sm font-medium text-gray-700 mb-1">
              Diagnosis Code
            </label>
            <input
              id="soap-diagnosis"
              type="text"
              value={form.diagnosis}
              onChange={e => set('diagnosis', e.target.value)}
              placeholder="Optional — ICD or short label"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 bg-gray-50">
          <span className="text-xs text-gray-500" aria-live="polite">
            {savedAt
              ? `Draft saved at ${savedAt.toLocaleTimeString()}`
              : consultationId
                ? 'Note started'
                : 'Not yet saved'}
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
            </button>
            {consultationId && (
              // Available once a note exists so the prescription can be tied
              // to this encounter rather than an unrelated earlier one.
              <button
                type="button"
                onClick={() => onPrescribe?.(consultationId)}
                className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-green-600 text-green-700 hover:bg-green-50"
              >
                <Pill className="w-4 h-4 mr-2" /> Add Prescription
              </button>
            )}
            <button
              type="button"
              onClick={handleSign}
              disabled={busy}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {signMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {signMutation.isPending ? 'Signing…' : 'Sign & Finalize Encounter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}