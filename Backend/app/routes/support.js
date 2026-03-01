const express = require('express');
const router = express.Router();
const {
  getAllTickets,
  getTicket,
  acceptTicket,
  rejectTicket,
  resolveTicket,
  addMessage,
  getSupportStats,
  getAllChatSupports,
  getChatSupport,
  acceptChatSupport,
  closeChatSupport,
  reopenChatSupport,
  addChatSupportMessage,
  broadcastMobileMessage
} = require('../controllers/supportController');
const { authMiddleware, adminAuth } = require('../middleware/auth');

// Public routes (no authentication required for mobile users)
router.post('/broadcast-mobile-message', broadcastMobileMessage);

// Mobile user routes (accessible without admin auth)
router.get('/chat/:chatSupportId', getChatSupport);
router.post('/chat/:chatSupportId/messages', addChatSupportMessage);

// Notification endpoints (no auth required for inter-service communication)
router.post('/notify-new-ticket', (req, res) => {
  console.log('New support ticket notification received:', req.body);
  const { emitSupportUpdate } = require('../socket/socketHandlers');
  emitSupportUpdate({ ticketId: req.body.ticketId }, 'new_ticket');
  res.json({ success: true });
});

// Upsert metadata/snapshot and emit new message
router.post('/notify-new-message', async (req, res) => {
  console.log('New support message notification received:', req.body);
  const { emitSupportUpdate } = require('../socket/socketHandlers');
  const ChatSupport = require('../models/ChatSupport');

  try {
    const { chatSupportId, jobDetailsSnapshot, metadata } = req.body;

    if (chatSupportId) {
      await ChatSupport.findByIdAndUpdate(
        chatSupportId,
        {
          ...(metadata ? { metadata } : {}),
          ...(jobDetailsSnapshot ? { jobDetailsSnapshot } : {})
        },
        { new: true }
      );
    }

    emitSupportUpdate({ ticketId: req.body.ticketId || chatSupportId, jobDetailsSnapshot, metadata }, 'new_message');
    res.json({ success: true });
  } catch (err) {
    console.error('Error handling notify-new-message:', err);
    res.status(500).json({ success: false, message: 'Failed to process support notification' });
  }
});

// Admin routes (require authentication)
router.use(authMiddleware);
router.use(adminAuth);

// GET /api/support/tickets - Get all tickets with filtering
router.get('/tickets', getAllTickets);

// GET /api/support/stats - Get support statistics
router.get('/stats', getSupportStats);

// GET /api/support/tickets/:ticketId - Get single ticket
router.get('/tickets/:ticketId', getTicket);

// PUT /api/support/tickets/:ticketId/accept - Accept ticket
router.put('/tickets/:ticketId/accept', acceptTicket);

// PUT /api/support/tickets/:ticketId/reject - Reject ticket
router.put('/tickets/:ticketId/reject', rejectTicket);

// PUT /api/support/tickets/:ticketId/resolve - Resolve ticket
router.put('/tickets/:ticketId/resolve', resolveTicket);

// POST /api/support/tickets/:ticketId/messages - Add message to ticket
router.post('/tickets/:ticketId/messages', addMessage);

// ChatSupport Routes (admin only)
router.get('/chatsupports', getAllChatSupports);
router.get('/chatsupports/:chatSupportId', getChatSupport);
router.put('/chatsupports/:chatSupportId/accept', (req, res, next) => {
  console.log('🎯 Accept endpoint hit:', req.params.chatSupportId);
  acceptChatSupport(req, res, next);
});
router.put('/chatsupports/:chatSupportId/close', closeChatSupport);
router.put('/chatsupports/:chatSupportId/reopen', reopenChatSupport);
router.post('/chatsupports/:chatSupportId/messages', addChatSupportMessage);

module.exports = router;
