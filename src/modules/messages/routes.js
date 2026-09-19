import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import * as db from '../../models/index.js';

const router = Router();

// Get user's conversations
router.get('/conversations', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res) => {
  try {
    const conversations = db.getUserConversations(req.user.id);
    res.json({ conversations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get or create conversation with specific user
router.get('/conversations/:userId', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    let conversation = db.getConversation(req.user.id, userId);
    
    if (!conversation) {
      conversation = db.createConversation(req.user.id, userId);
    }
    
    const messages = db.getConversationMessages(conversation.id);
    res.json({ conversation, messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res) => {
  try {
    const messages = db.getConversationMessages(req.params.id, req.query.limit || 50);
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send message
router.post('/conversations/:id/messages', authorize(['SuperAdmin', 'Admin', 'Receptionist', 'Doctor', 'Nurse']), (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content is required' });

    const result = db.sendMessage(req.params.id, req.user.id, content);
    const message = db.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
