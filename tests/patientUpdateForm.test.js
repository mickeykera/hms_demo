import { describe, it, expect } from 'vitest';

import {
  buildPatientUpdatePayload,
  isEmptyUpdate,
  UPDATABLE_FIELDS,
} from '../frontend/src/utils/patientUpdate.js';

/**
 * The patient row as it comes back from GET /api/reception/search, including
 * the server-owned columns the Edit button copies into formData verbatim.
 */
const EXISTING = {
  id: 42,
  global_id: 'HMS-ABC123-X9',
  first_name: 'Amara',
  last_name: 'Okonkwo',
  date_of_birth: '1988-03-14',
  gender: 'Female',
  blood_type: 'O+',
  email: 'a.okonkwo@example.org',
  phone: '+44 7700 900123',
  address: '12 Ward Road',
  emergency_contact_name: 'Chidi Okonkwo',
  emergency_contact_phone: '+44 7700 900999',
  insurance_provider: 'NHS',
  insurance_id: 'NHS-99881',
  insurance_validity: '2027-04-01',
  created_at: '2026-01-02 09:00:00',
  updated_at: '2026-01-02 09:00:00',
};

const FORM_DEFAULTS = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'Male',
  blood_type: '',
  email: '',
  phone: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  insurance_provider: '',
  insurance_id: '',
  insurance_validity: '',
};

describe('buildPatientUpdatePayload', () => {
  it('should return nothing when the form was not opened for an existing patient', () => {
    expect(buildPatientUpdatePayload({}, {})).toEqual({});
    expect(isEmptyUpdate(buildPatientUpdatePayload({}, {}))).toBe(true);
  });

  it('should send only the field that changed', () => {
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      phone: '+44 7700 900555',
    });

    expect(payload).toEqual({ phone: '+44 7700 900555' });
    expect(Object.keys(payload)).toHaveLength(1);
  });

  it('should send several changed fields together', () => {
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      address: '99 New Road',
      blood_type: 'A-',
      emergency_contact_phone: '+44 7700 900111',
    });

    expect(payload).toEqual({
      address: '99 New Road',
      blood_type: 'A-',
      emergency_contact_phone: '+44 7700 900111',
    });
  });

  it('should never include server-owned columns', () => {
    // The Edit button does setFormData(patient), so id/global_id/created_at are
    // sitting in formData. They must never reach an UPDATE.
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      id: 999,
      global_id: 'HMS-ATTACKER-0000',
      created_at: '2020-01-01 00:00:00',
      first_name: 'Changed',
    });

    expect(payload).toEqual({ first_name: 'Changed' });
    expect(payload.id).toBeUndefined();
    expect(payload.global_id).toBeUndefined();
    expect(payload.created_at).toBeUndefined();
  });

  it('should drop an empty date_of_birth rather than sending it', () => {
    // The bug that broke every edit: a date input the user never touched still
    // submits as "", which fails the server's /^\d{4}-\d{2}-\d{2}$/ regex and
    // turns the whole save into a 400.
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      date_of_birth: '',
      first_name: 'Amara-Edited',
    });

    expect(payload).toEqual({ first_name: 'Amara-Edited' });
    expect('date_of_birth' in payload).toBe(false);
  });

  it('should drop empty strings for every other field too', () => {
    // Forwarding "" for insurance_validity or phone would blank real data the
    // user never intended to clear.
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      address: '',
      email: '',
      insurance_validity: '',
      first_name: 'Still Edited',
    });

    expect(payload).toEqual({ first_name: 'Still Edited' });
  });

  it('should ignore fields that are not editable from this screen', () => {
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      medical_history_summary: 'injected',
      role: 'SuperAdmin',
      somethingNew: 'nope',
      first_name: 'Renamed',
    });

    expect(payload).toEqual({ first_name: 'Renamed' });
  });

  it('should ignore null and undefined rather than clearing a value', () => {
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      address: null,
      phone: undefined,
      blood_type: 'B+',
    });

    expect(payload).toEqual({ blood_type: 'B+' });
  });

  it('should report an empty update when only empty fields changed', () => {
    // Nothing meaningful changed, so no request should be made at all --
    // the server would answer 400 "At least one field must be provided".
    const payload = buildPatientUpdatePayload(EXISTING, {
      ...EXISTING,
      date_of_birth: '',
      email: '',
    });

    expect(payload).toEqual({});
    expect(isEmptyUpdate(payload)).toBe(true);
  });

  it('should tolerate being called with no arguments', () => {
    expect(buildPatientUpdatePayload()).toEqual({});
  });

  it('should allow every field it exposes to be changed', () => {
    // Guards against a field being added to the form but forgotten here,
    // which would make it silently un-editable.
    const edited = { ...EXISTING };
    for (const field of UPDATABLE_FIELDS) {
      edited[field] = `changed-${field}`;
    }
    const payload = buildPatientUpdatePayload(EXISTING, edited);

    for (const field of UPDATABLE_FIELDS) {
      expect(payload[field], `${field} should be updatable`).toBe(`changed-${field}`);
    }
  });

  it('should keep the field list in step with the form defaults', () => {
    // FORM_DEFAULTS is the shape the component initialises; a field in one and
    // not the other means a silently un-editable input.
    const missing = Object.keys(FORM_DEFAULTS).filter((f) => !UPDATABLE_FIELDS.includes(f));
    const extra = UPDATABLE_FIELDS.filter((f) => !(f in FORM_DEFAULTS));

    expect(missing, 'form fields that can never be saved').toEqual([]);
    expect(extra, 'updatable fields absent from the form').toEqual([]);
  });
});