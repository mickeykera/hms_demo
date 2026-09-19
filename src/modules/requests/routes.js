import { Router } from 'express';
import { authorize, requirePermission, checkPatientAccess } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';

const router = Router();

const requestSchema = z.object({
  requesting_department_id: z.number().int().positive(),
  receiving_department_id: z.number().int().positive(),
  patient_id: z.number().int().positive(),
  request_type: z.enum(['LabTest', 'Imaging', 'Pharmacy', 'Consultation', 'Referral', 'Admission', 'Transfer', 'Procedure', 'Other']),
  priority: z.enum(['Routine', 'Urgent', 'Stat', 'Emergency']).default('Routine'),
  clinical_details: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['Pending', 'Accepted', 'InProgress', 'Completed', 'Verified', 'Cancelled', 'Rejected']),
});

const updateResultSchema = z.object({
  result_data: z.string().min(1),
  result_notes: z.string().optional(),
});

// Create department request (Doctors, Nurses, Emergency)
router.post('/', authorize('Doctor', 'Nurse', 'Emergency', 'Admin', 'SuperAdmin'), validate('request'), (req, res) => {
  try {
    const db2 = db.getDb();
    
    // Get requesting user's department
    const personnel = db.getPersonnelByUserId(req.user.id);
    const requesting_department_id = req.validated.requesting_department_id || personnel?.department_id;
    
    if (!requesting_department_id) {
      return res.status(400).json({ error: 'Requesting department not specified and user has no department' });
    }
    
    const result = db.createDepartmentRequest({
      ...req.validated,
      requesting_user_id: req.user.id,
      requesting_department_id,
    });
    
    const request = db.getDepartmentRequestById(result.lastInsertRowid);
    
    // Notify receiving department staff
    const receivingStaff = db2.prepare(`
      SELECT u.id FROM users u 
      JOIN personnel p ON u.personnel_id = p.id 
      WHERE p.department_id = ? AND u.active = 1
    `).all(req.validated.receiving_department_id);
    
    const patient = db.getPatientById(req.validated.patient_id);
    const receivingDept = db.getDepartmentById(req.validated.receiving_department_id);
    
    for (const staff of receivingStaff) {
      db.createNotification({
        recipient_id: staff.id,
        type: 'DEPARTMENT_REQUEST',
        title: `New ${req.validated.request_type} Request`,
        message: `${req.validated.request_type} requested for patient ${patient?.first_name} ${patient?.last_name} by ${req.user.full_name}`,
        related_entity: 'department_request',
        related_entity_id: request.id,
      });
    }
    
    // Also notify requesting doctor
    db.createNotification({
      recipient_id: req.user.id,
      type: 'DEPARTMENT_REQUEST_CREATED',
      title: 'Request Submitted',
      message: `Your ${req.validated.request_type} request has been sent to ${receivingDept?.name}`,
      related_entity: 'department_request',
      related_entity_id: request.id,
    });
    
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'CREATE',
      resource_type: 'department_request',
      resource_id: request.id,
      details: `Created ${req.validated.request_type} request for patient ${patient?.global_id}`,
      ip_address: req.ip,
    });
    
    res.status(201).json({ success: true, request });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get requests (with filters)
router.get('/', authorize('Doctor', 'Nurse', 'LabTech', 'Radiology', 'Pharmacy', 'Admin', 'SuperAdmin', 'Emergency'), (req, res) => {
  try {
    const filters = {
      patient_id: req.query.patient_id ? parseInt(req.query.patient_id) : undefined,
      receiving_department_id: req.query.receiving_department_id ? parseInt(req.query.receiving_department_id) : undefined,
      requesting_department_id: req.query.requesting_department_id ? parseInt(req.query.requesting_department_id) : undefined,
      status: req.query.status,
      request_type: req.query.request_type,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
    };
    
    // If user is department staff, default to their department
    if (['LabTech', 'Radiology', 'Pharmacy'].includes(req.user.role)) {
      const personnel = db.getPersonnelByUserId(req.user.id);
      if (personnel?.department_id && !filters.receiving_department_id) {
        filters.receiving_department_id = personnel.department_id;
      }
    }
    
    // If doctor/nurse, default to their requests
    if (['Doctor', 'Nurse', 'Emergency'].includes(req.user.role) && !filters.requesting_department_id) {
      const personnel = db.getPersonnelByUserId(req.user.id);
      if (personnel?.department_id) {
        filters.requesting_department_id = personnel.department_id;
      }
    }
    
    const requests = db.getDepartmentRequests(filters);
    res.json({ requests });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get request by ID
router.get('/:id', authorize('Doctor', 'Nurse', 'LabTech', 'Radiology', 'Pharmacy', 'Admin', 'SuperAdmin', 'Emergency'), (req, res) => {
  try {
    const request = db.getDepartmentRequestById(parseInt(req.params.id));
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json({ request });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update request status (receiving department staff, admin)
router.put('/:id/status', authorize('LabTech', 'Radiology', 'Pharmacy', 'Doctor', 'Nurse', 'Admin', 'SuperAdmin'), validate('updateStatus'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const request = db.getDepartmentRequestById(id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    // Verify user belongs to receiving department or is admin
    const personnel = db.getPersonnelByUserId(req.user.id);
    const isReceivingDept = personnel?.department_id === request.receiving_department_id;
    const isRequester = request.requesting_user_id === req.user.id;
    const isAdmin = ['Admin', 'SuperAdmin'].includes(req.user.role);
    
    if (!isReceivingDept && !isRequester && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to update this request' });
    }
    
    const oldStatus = request.status;
    db.updateDepartmentRequestStatus(id, req.validated.status, req.user.id);
    
    const updated = db.getDepartmentRequestById(id);
    
    // Notify requester of status change
    const statusMessages = {
      'Accepted': 'has been accepted',
      'InProgress': 'is now in progress',
      'Completed': 'has been completed',
      'Verified': 'has been verified',
      'Cancelled': 'has been cancelled',
      'Rejected': 'has been rejected',
    };
    
    if (statusMessages[req.validated.status]) {
      db.createNotification({
        recipient_id: request.requesting_user_id,
        type: 'DEPARTMENT_REQUEST_UPDATE',
        title: 'Request Status Update',
        message: `Your ${request.request_type} request ${statusMessages[req.validated.status]}`,
        related_entity: 'department_request',
        related_entity_id: request.id,
      });
    }
    
    // If completed/verified, notify all doctors involved
    if (['Completed', 'Verified'].includes(req.validated.status)) {
      const doctors = db2.prepare("SELECT id FROM users WHERE role IN ('Doctor', 'Admin') AND active = 1").all();
      for (const doctor of doctors) {
        if (doctor.id !== request.requesting_user_id) {
          db.createNotification({
            recipient_id: doctor.id,
            type: 'DEPARTMENT_REQUEST_COMPLETED',
            title: 'Request Completed',
            message: `${request.request_type} request for patient ${request.first_name} ${request.last_name} is now ${req.validated.status.toLowerCase()}`,
            related_entity: 'department_request',
            related_entity_id: request.id,
          });
        }
      }
    }
    
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'UPDATE_STATUS',
      resource_type: 'department_request',
      resource_id: id,
      details: `Status changed from ${oldStatus} to ${req.validated.status}`,
      ip_address: req.ip,
    });
    
    res.json({ success: true, request: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update request result (receiving department staff)
router.put('/:id/result', authorize('LabTech', 'Radiology', 'Pharmacy', 'Admin', 'SuperAdmin'), validate('updateResult'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const request = db.getDepartmentRequestById(id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    // Verify user belongs to receiving department or is admin
    const personnel = db.getPersonnelByUserId(req.user.id);
    const isReceivingDept = personnel?.department_id === request.receiving_department_id;
    const isAdmin = ['Admin', 'SuperAdmin'].includes(req.user.role);
    
    if (!isReceivingDept && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to update this request result' });
    }
    
    db.updateDepartmentRequestResult(id, req.validated.result_data, req.validated.result_notes, req.user.id);
    
    const updated = db.getDepartmentRequestById(id);
    
    // Notify requester
    db.createNotification({
      recipient_id: request.requesting_user_id,
      type: 'DEPARTMENT_REQUEST_RESULT',
      title: 'Request Result Available',
      message: `Results are available for your ${request.request_type} request`,
      related_entity: 'department_request',
      related_entity_id: request.id,
    });
    
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'UPDATE_RESULT',
      resource_type: 'department_request',
      resource_id: id,
      details: `Result entered for ${request.request_type} request`,
      ip_address: req.ip,
    });
    
    res.json({ success: true, request: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get requests for a specific patient
router.get('/patient/:patientId', authorize('Doctor', 'Nurse', 'Admin', 'SuperAdmin'), checkPatientAccess, (req, res) => {
  try {
    const requests = db.getDepartmentRequests({ patient_id: parseInt(req.params.patientId), limit: 100 });
    res.json({ requests });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;