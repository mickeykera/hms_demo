import { Router } from 'express';
import { authorize, checkPatientAccess } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';
import { z } from 'zod';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadDir = join(__dirname, '..', '..', '..', 'uploads', 'documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'application/dicom'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, TIFF, DICOM'));
    }
  },
});

const router = Router();

const documentSchema = z.object({
  patient_id: z.number().int().positive(),
  department_id: z.number().int().positive().optional(),
  document_type: z.enum(['LabReport', 'ImagingReport', 'MedicalCertificate', 'DischargeSummary', 'ReferralLetter', 'Prescription', 'ConsentForm', 'InsuranceDocument', 'Other']),
  title: z.string().min(1),
  access_level: z.enum(['Private', 'Department', 'Hospital', 'Patient']).default('Department'),
  parent_document_id: z.number().int().positive().optional(),
});

// Upload document
router.post('/', authorize('Doctor', 'Nurse', 'LabTech', 'Radiology', 'Pharmacy', 'Admin', 'SuperAdmin', 'Receptionist'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const data = JSON.parse(req.body.data || '{}');
    const validated = documentSchema.parse(data);
    
    const patient = db.getPatientById(validated.patient_id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    
    const document = db.createDocument({
      ...validated,
      uploaded_by: req.user.id,
      file_path: req.file.path,
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
    });
    
    const created = db.getDocumentById(document.lastInsertRowid);
    
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'UPLOAD',
      resource_type: 'document',
      resource_id: created.id,
      details: `Uploaded ${validated.document_type}: ${validated.title} for patient ${patient.global_id}`,
      ip_address: req.ip,
    });
    
    res.status(201).json({ success: true, document: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get documents for a patient
router.get('/patient/:patientId', authorize('Doctor', 'Nurse', 'LabTech', 'Radiology', 'Pharmacy', 'Admin', 'SuperAdmin', 'Patient'), checkPatientAccess, (req, res) => {
  try {
    const accessLevel = req.query.access_level;
    const documents = db.getDocumentsByPatient(parseInt(req.params.patientId), accessLevel);
    res.json({ documents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get document by ID
router.get('/:id', authorize('Doctor', 'Nurse', 'LabTech', 'Radiology', 'Pharmacy', 'Admin', 'SuperAdmin', 'Patient'), (req, res) => {
  try {
    const document = db.getDocumentById(parseInt(req.params.id));
    if (!document) return res.status(404).json({ error: 'Document not found' });
    
    // Check access based on access_level
    if (document.access_level === 'Private' && document.uploaded_by !== req.user.id && req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (document.access_level === 'Department') {
      const personnel = db.getPersonnelByUserId(req.user.id);
      if (personnel?.department_id !== document.department_id && req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    if (document.access_level === 'Patient' && req.user.role !== 'Patient' && req.user.role !== 'SuperAdmin' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ document });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download document
router.get('/:id/download', authorize('Doctor', 'Nurse', 'LabTech', 'Radiology', 'Pharmacy', 'Admin', 'SuperAdmin', 'Patient'), (req, res) => {
  try {
    const document = db.getDocumentById(parseInt(req.params.id));
    if (!document) return res.status(404).json({ error: 'Document not found' });
    
    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    res.download(document.file_path, document.file_name);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete document (admin or uploader)
router.delete('/:id', authorize('Admin', 'SuperAdmin'), (req, res) => {
  try {
    const document = db.getDocumentById(parseInt(req.params.id));
    if (!document) return res.status(404).json({ error: 'Document not found' });
    
    if (document.uploaded_by !== req.user.id && req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Not authorized to delete this document' });
    }
    
    // Soft delete - mark as deleted or actually delete file
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }
    
    db.getDb().prepare('DELETE FROM documents WHERE id = ?').run(document.id);
    
    db.createAuditLog({
      actor_id: req.user.id,
      action: 'DELETE',
      resource_type: 'document',
      resource_id: document.id,
      details: `Deleted document: ${document.title}`,
      ip_address: req.ip,
    });
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;