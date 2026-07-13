const express = require('express');
const mongoose = require('mongoose');

const {
  getSupportStats,
  getAllChatSupports,
  getChatSupport,
  acceptChatSupport,
  closeChatSupport,
  reopenChatSupport,
  addChatSupportMessage,
  addInternalNote,
  broadcastMobileMessage
} = require('../controllers/supportController');
const { authMiddleware, adminAuth } = require('../middleware/auth');
const { supportServiceAuth } = require('../middleware/supportServiceAuth');

const router = express.Router();

// Inter-service routes. Mobile clients use the authenticated endpoints on the
// main Kayod API; these admin-backend callbacks are only for server-to-server
// synchronization and socket fan-out.
router.post(
  '/broadcast-mobile-message',
  supportServiceAuth,
  broadcastMobileMessage
);

router.post('/notify-new-ticket', supportServiceAuth, async (req, res) => {
  const { emitSupportUpdate, emitNewChatSupport } = require('../socket/socketHandlers');
  const ChatSupport = require('../models/ChatSupport');

  try {
    // If a ChatSupport was created alongside the ticket, emit it to the admin
    // panel — support:new_chat triggers fetchTickets() in useSupportSocket.
    const { chatSupportId } = req.body;
    if (chatSupportId && mongoose.isValidObjectId(chatSupportId)) {
      const chatSupport = await ChatSupport.findById(chatSupportId).lean();
      if (chatSupport) {
        emitNewChatSupport(chatSupport);
      }
    }

    // Also emit the legacy ticket_updated event for backwards compat
    emitSupportUpdate(
      {
        ticketId: req.body.ticketId,
        chatSupportId,
        priority: req.body.priority
      },
      'new_ticket'
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Error handling notify-new-ticket:', err);
    // Still return 200 so the mobile side doesn't retry indefinitely
    return res.json({ success: false, message: err.message });
  }
});

router.post('/notify-new-message', supportServiceAuth, async (req, res) => {
  const { emitSupportUpdate } = require('../socket/socketHandlers');
  const ChatSupport = require('../models/ChatSupport');

  try {
    const {
      chatSupportId,
      ticketId,
      jobDetailsSnapshot,
      metadata,
      priority
    } = req.body;

    if (chatSupportId) {
      if (!mongoose.isValidObjectId(chatSupportId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid chat support ID'
        });
      }

      const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);
      const updates = {
        ...(metadata ? { metadata } : {}),
        ...(jobDetailsSnapshot ? { jobDetailsSnapshot } : {}),
        ...(allowedPriorities.has(priority) ? { priority } : {})
      };

      const updatedChat = await ChatSupport.findByIdAndUpdate(
        chatSupportId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!updatedChat) {
        return res.status(404).json({
          success: false,
          message: 'Chat support not found'
        });
      }
    }

    emitSupportUpdate(
      {
        ticketId: ticketId || chatSupportId,
        chatSupportId,
        jobDetailsSnapshot,
        metadata,
        priority
      },
      'new_message'
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Error handling support notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process support notification'
    });
  }
});

// Admin routes (require an authenticated admin session).
router.use(authMiddleware);
router.use(adminAuth);

router.get('/stats', getSupportStats);

router.get('/chatsupports', getAllChatSupports);
router.get('/chatsupports/:chatSupportId', getChatSupport);
router.put('/chatsupports/:chatSupportId/accept', acceptChatSupport);
router.put('/chatsupports/:chatSupportId/close', closeChatSupport);
router.put('/chatsupports/:chatSupportId/reopen', reopenChatSupport);
router.post('/chatsupports/:chatSupportId/messages', addChatSupportMessage);
router.post('/chatsupports/:chatSupportId/internal-notes', addInternalNote);

module.exports = router;
