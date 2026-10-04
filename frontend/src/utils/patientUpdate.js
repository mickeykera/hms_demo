/**
 * Builds the request body for a patient update.
 *
 * Deliberately separate from the component so it can be unit-tested without a
 * DOM, and so the rules below are stated once rather than implied by JSX.
 *
 * Three rules, each of which the server would otherwise reject or mishandle:
 *
 *  1. SEND ONLY WHAT CHANGED. The Edit button seeds the form from the whole
 *     patient row, so `formData` carries every column -- id, global_id,
 *     created_at, updated_at. Posting that back would ask the server to rewrite
 *     its own primary key, and any column the client tampered with would ride
 *     along. The API validates against an allow-list, but sending less is still
 *     the correct behaviour: a PATCH-shaped edit should not claim to write
 *     fields it did not touch.
 *
 *  2. NEVER SEND AN EMPTY date_of_birth. A date input that the user never
 *     touched still submits as "". The schema requires /^\d{4}-\d{2}-\d{2}$/,
 *     so an untouched date field turned every edit into a 400.
 *
 *  3. NEVER SEND UNCHANGED OR EMPTY VALUES for the other fields either. An
 *     empty insurance_validity or phone is not a change; forwarding it would
 *     blank data the user never intended to clear.
 */

// Kept in step with the `patientUpdate` schema in src/middleware/validation.js.
// A field absent from this list can never be edited from this screen.
export const UPDATABLE_FIELDS = Object.freeze([
  'first_name',
  'last_name',
  'date_of_birth',
  'gender',
  'blood_type',
  'email',
  'phone',
  'address',
  'emergency_contact_name',
  'emergency_contact_phone',
  'insurance_provider',
  'insurance_id',
  'insurance_validity',
]);

/**
 * @param {object} existing the patient as loaded from the server
 * @param {object} formData the form's current values
 * @returns {object} a body containing only changed, non-empty, allowed fields
 */
export function buildPatientUpdatePayload(existing = {}, formData = {}) {
  const payload = {};

  for (const field of UPDATABLE_FIELDS) {
    const next = formData[field];

    // Undefined/null means the form has no value for this field at all.
    if (next === undefined || next === null) continue;

    // An empty string is never a legitimate update for any of these fields.
    // For date_of_birth this is not merely cosmetic -- "" fails the server's
    // format regex, so an untouched date input broke every edit.
    if (next === '') continue;

    const previous = existing[field];
    if (next === previous) continue;

    payload[field] = next;
  }

  return payload;
}

/** True when there is nothing to save, so no request should be made. */
export function isEmptyUpdate(payload) {
  return Object.keys(payload).length === 0;
}