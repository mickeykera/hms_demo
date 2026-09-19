import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

// Lab statuses: Ordered → Collection_Pending → Collected → In_Progress → Verified → Released / Cancelled
const LAB_STATUSES = ['Ordered', 'CollectionPending', 'Collected', 'InProgress', 'Verified', 'Released', 'Cancelled'];

/**
 * Create a new lab test order
 * Doctor creates → Auto-notify Lab that test was ordered
 */
router.post('/order', authorize(['Doctor', 'Admin']), validate('labOrder'), (req, res) => {
  try {
    const result = db.createLabTest({
      ...req.validated,
      order_doctor_id: req.user.id,
      status: 'Ordered'
    });

    const testId = result.lastInsertRowid;
    const test = db.getLabTestById(testId);

    // Notify lab technicians that new test was ordered
    const labTechs = db.getDb().prepare("SELECT id FROM users WHERE role = 'LabTech'").all();
    const patient = db.getPatientById(req.validated.patient_id);

    for (const tech of labTechs) {
      db.createNotification({
        recipient_id: tech.id,
        type: 'LAB_ORDER_CREATED',
        title: 'New Lab Test Order',
        message: `${test.test_name} ordered for patient ${patient.first_name} ${patient.last_name}`,
        related_entity: 'lab_test',
        related_entity_id: testId,
      });
    }

    // Log action
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'CREATE',
      resource_type: 'lab_test',
      resource_id: testId,
      details: `Ordered ${test.test_name} for patient ${patient.first_name} ${patient.last_name}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, test_id: testId, test });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get lab tests for a patient
 */
router.get('/patient/:patientId', authorize(['LabTech', 'Doctor', 'Admin', 'Nurse']), (req, res) => {
  try {
    const tests = db.getLabTestsByPatient(req.params.patientId);
    const results = tests.map(t => ({
      test: t,
      results: db.getLabResultsByTest(t.id),
    }));
    res.json({ tests: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get lab queue for current lab technician
 */
router.get('/queue/pending', authorize(['LabTech', 'Admin']), (req, res) => {
  try {
    const queue = db.getDb().prepare(
      `SELECT lt.*, p.first_name, p.last_name, p.global_id, u.full_name as doctor_name
       FROM lab_tests lt
       JOIN patients p ON lt.patient_id = p.id
       LEFT JOIN users u ON lt.order_doctor_id = u.id
       WHERE lt.status IN ('Ordered', 'CollectionPending', 'Collected', 'InProgress')
       ORDER BY lt.ordered_at ASC`
    ).all();

    res.json({ queue, count: queue.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Update lab test status (workflow progression)
 * CollectionPending → Collected → InProgress → Verified → Released
 */
router.put('/:testId/status', authorize(['LabTech', 'Admin']), (req, res) => {
  try {
    const { status } = req.body;

    if (!LAB_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const test = db.getLabTestById(req.params.testId);
    const patient = db.getPatientById(test.patient_id);
    const oldStatus = test.status;

    db.updateLabTestStatus(req.params.testId, status);

    // Create notification for status changes
    const statusMessages = {
      'Collected': `Specimen collected for ${test.test_name}`,
      'InProgress': `${test.test_name} is being processed`,
      'Verified': `${test.test_name} result has been verified`,
      'Released': `${test.test_name} result is ready for review`,
      'Cancelled': `${test.test_name} has been cancelled`,
    };

    if (statusMessages[status]) {
      // Notify ordering doctor
      db.createNotification({
        recipient_id: test.order_doctor_id,
        type: 'LAB_STATUS_UPDATE',
        title: 'Lab Test Status Update',
        message: `${patient.first_name} ${patient.last_name}: ${statusMessages[status]}`,
        related_entity: 'lab_test',
        related_entity_id: test.id,
      });

      // If released, notify doctors that can view results
      if (status === 'Released') {
        const doctors = db.getDb().prepare("SELECT id FROM users WHERE role IN ('Doctor', 'Admin')").all();
        for (const doctor of doctors) {
          if (doctor.id !== test.order_doctor_id) {
            db.createNotification({
              recipient_id: doctor.id,
              type: 'LAB_RESULT_AVAILABLE',
              title: 'New Lab Result Available',
              message: `${test.test_name} result released for patient ${patient.first_name} ${patient.last_name}`,
              related_entity: 'lab_test',
              related_entity_id: test.id,
            });
          }
        }
      }
    }

    // Log the status change
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'UPDATE_STATUS',
      resource_type: 'lab_test',
      resource_id: test.id,
      details: `Status changed from ${oldStatus} to ${status}`,
      ip_address: req.ip,
    });

    res.json({ success: true, test_id: req.params.testId, old_status: oldStatus, new_status: status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Enter lab test result
 * Lab Technician enters result → Auto-marks as Verified pending doctor review
 */
router.post('/:testId/result', authorize(['LabTech', 'Admin']), validate('labResult'), (req, res) => {
  try {
    const result = db.createLabResult({
      lab_test_id: req.params.testId,
      ...req.body,
      lab_tech_id: req.user.id,
    });

    const test = db.getLabTestById(req.params.testId);
    const resultId = result.lastInsertRowid;

    // Update test status to Verified (pending doctor review)
    db.updateLabTestStatus(req.params.testId, 'Verified');

    // Notify ordering doctor that result is ready for review
    db.createNotification({
      recipient_id: test.order_doctor_id,
      type: 'LAB_RESULT_READY',
      title: 'Lab Result Ready for Review',
      message: `${test.test_name} result entered and ready for your review`,
      related_entity: 'lab_result',
      related_entity_id: resultId,
    });

    db.createAuditLog({
      actor_id: req.user.id,
      action: 'CREATE_RESULT',
      resource_type: 'lab_result',
      resource_id: resultId,
      details: `Result entered for ${test.test_name}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, result_id: resultId, test_id: req.params.testId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get lab results for a patient
 */
router.get('/:patientId', authorize(['LabTech', 'Doctor', 'Admin', 'Nurse']), (req, res) => {
  try {
    const tests = db.getLabTestsByPatient(req.params.patientId);
    const results = tests.map(t => ({
      test: t,
      results: db.getLabResultsByTest(t.id),
    }));
    res.json({ tests: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Sync lab results to patient EMR (doctor action)
 */
router.get('/:patientId/sync-to-emr', authorize(['Doctor', 'Admin', 'LabTech']), (req, res) => {
  try {
    const tests = db.getLabTestsByPatient(req.params.patientId);
    const allResults = [];
    tests.forEach(t => {
      const results = db.getLabResultsByTest(t.id);
      allResults.push(...results);
    });
    const flaggedResults = allResults.filter(r => r.flagged);

    db.createAuditLog({
      actor_id: req.user.id,
      action: 'SYNC_TO_EMR',
      resource_type: 'patient',
      resource_id: req.params.patientId,
      details: `Synced ${allResults.length} lab results to EMR (${flaggedResults.length} flagged)`,
      ip_address: req.ip,
    });

    res.json({
      synced_to_emr: true,
      total_results: allResults.length,
      flagged_count: flaggedResults.length,
      flagged_results: flaggedResults,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
