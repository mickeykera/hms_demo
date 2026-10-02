-- Migration: Doctor charting (SOAP notes) for consultations
-- Created: 2026-10-01
--
-- The seven columns this migration originally carried (subjective, objective,
-- assessment, plan, status, signed_at, updated_at) are declared directly in
-- schema.sql, and applyColumnBackfills() in src/models/index.js adds them to
-- databases created before that change. Since `npm run migrate` is only ever
-- valid on a database the app has already opened, those ALTER TABLEs could
-- never succeed -- they always failed with "duplicate column name", which
-- aborted the whole runner on a fresh install and prevented every later
-- migration (notably 20261002_operational_modules) from applying.
--
-- SQLite has no ADD COLUMN IF NOT EXISTS, so idempotent column additions
-- cannot be expressed in .sql. The columns are therefore owned by
-- schema.sql/backfills and this migration only creates the indexes, which
-- are idempotent.

CREATE INDEX IF NOT EXISTS idx_consultations_doctor_status ON consultations(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_date ON consultations(patient_id, consultation_date);

