import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();

// Get all notifications for current user
router.get('/', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse', 'LabTech', 'Pharmacy', 'Radiology', 'OperatingRoom', 'WardStaff', 'Billing', 'Patient']), (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const notifications = db.getNotifications(req.user.id, unreadOnly);
    res.json({ notifications, count: notifications.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get unread notification count
router.get('/count', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse', 'LabTech', 'Pharmacy', 'Radiology', 'OperatingRoom', 'WardStaff', 'Billing', 'Patient']), (req, res) => {
  try {
    const notifications = db.getNotifications(req.user.id, true);
    res.json({ unread_count: notifications.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark notification as read
router.put('/:id/read', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse', 'LabTech', 'Pharmacy', 'Radiology', 'OperatingRoom', 'WardStaff', 'Billing', 'Patient']), (req, res) => {
  try {
    db.markNotificationAsRead(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark all notifications as read
router.put('/read-all', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse', 'LabTech', 'Pharmacy', 'Radiology', 'OperatingRoom', 'WardStaff', 'Billing', 'Patient']), (req, res) => {
  try {
    db.markAllNotificationsAsRead(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create notification (admin/system only)
router.post('/', authorize(['SuperAdmin', 'Admin']), (req, res) => {
  try {
    const result = db.createNotification(req.body);
    res.status(201).json({ success: true, notification_id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
