const express = require('express');
const router = express.Router();
const {
  getAllTickets,
  getTicket,
  acceptTicket,
  rejectTicket,
  resolveTicket,
  addMessage,
  getSupportStats
} = require('../controllers/supportController');
const { authMiddleware, adminAuth } = require('../middleware/auth'); // Assuming you have auth middleware

// Apply authentication middleware to all routes
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

// Notification endpoint (no auth required for inter-service communication)
router.post('/notify-new-ticket', (req, res) => {
  // Log the new ticket notification
  console.log('New support ticket notification received:', req.body);
  // Emit socket event to notify admins
  const { emitSupportUpdate } = require('../socket/socketHandlers');
  emitSupportUpdate({ ticketId: req.body.ticketId }, 'new_ticket');
  res.json({ success: true });
});

router.post('/notify-new-message', (req, res) => {
  // Log the new message notification
  console.log('New support message notification received:', req.body);
  // Emit socket event to notify admins
  const { emitSupportUpdate } = require('../socket/socketHandlers');
  emitSupportUpdate({ ticketId: req.body.ticketId }, 'new_message');
  res.json({ success: true });
});

module.exports = router;
