import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();

// Get user's conversations
router.get('/conversations', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res, next) => {
  try {
    const conversations = db.getUserConversations(req.user.id);
    res.json({ conversations });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Get or create conversation with specific user
router.get('/conversations/:userId', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    let conversation = db.getConversation(req.user.id, userId);
    
    if (!conversation) {
      conversation = db.createConversation(req.user.id, userId);
    }
    
    const messages = db.getConversationMessages(conversation.id);
    res.json({ conversation, messages });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res, next) => {
  try {
    const messages = db.getConversationMessages(req.params.id, req.query.limit || 50);
    res.json({ messages });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

// Send message
router.post('/conversations/:id/messages', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content is required' });

    const result = db.sendMessage(req.params.id, req.user.id, content);
    const message = db.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, message });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

export default router;
