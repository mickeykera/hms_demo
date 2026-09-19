import { describe, it, expect } from 'vitest';
import { validate, schemas } from '../src/middleware/validation.js';

describe('Validation Middleware', () => {
  it('should validate patientRegister schema with valid data', () => {
    const validData = {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1990-01-01',
      gender: 'Male',
      phone: '555-1234',
    };
    const result = schemas.patientRegister.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject patientRegister with missing required fields', () => {
    const invalidData = {
      first_name: 'John',
    };
    const result = schemas.patientRegister.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors).toHaveProperty('last_name');
    expect(result.error.flatten().fieldErrors).toHaveProperty('date_of_birth');
    expect(result.error.flatten().fieldErrors).toHaveProperty('gender');
    expect(result.error.flatten().fieldErrors).toHaveProperty('phone');
  });

  it('should reject patientRegister with invalid gender', () => {
    const invalidData = {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1990-01-01',
      gender: 'Invalid',
      phone: '555-1234',
    };
    const result = schemas.patientRegister.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.gender).toBeDefined();
  });

  it('should reject patientRegister with invalid date format', () => {
    const invalidData = {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '01-01-1990',
      gender: 'Male',
      phone: '555-1234',
    };
    const result = schemas.patientRegister.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.date_of_birth).toBeDefined();
  });

  it('should validate consultation schema with valid data', () => {
    const validData = {
      visit_id: 1,
      patient_id: 1,
      doctor_id: 1,
      chief_complaint: 'Headache',
    };
    const result = schemas.consultation.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate prescription schema with valid data', () => {
    const validData = {
      consultation_id: 1,
      medication_name: 'Ibuprofen',
      dosage: '400mg',
      frequency: 'Every 6 hours',
    };
    const result = schemas.prescription.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate invoice schema with valid data', () => {
    const validData = {
      patient_id: 1,
      total_amount: 100.50,
    };
    const result = schemas.invoice.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate labOrder schema with valid data', () => {
    const validData = {
      patient_id: 1,
      test_name: 'CBC',
      sample_id: 'SMP-001',
    };
    const result = schemas.labOrder.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate admission schema with valid data', () => {
    const validData = {
      patient_id: 1,
      bed_id: 1,
      reason: 'Pneumonia',
    };
    const result = schemas.admission.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate orSchedule schema with valid data', () => {
    const validData = {
      patient_id: 1,
      procedure_name: 'Appendectomy',
      scheduled_date: '2025-12-01 10:00:00',
      surgeon_id: 1,
    };
    const result = schemas.orSchedule.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate login schema with valid data', () => {
    const validData = {
      username: 'admin',
      password: 'password123',
    };
    const result = schemas.login.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject login with missing fields', () => {
    const invalidData = {
      username: 'admin',
    };
    const result = schemas.login.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.password).toBeDefined();
  });
});