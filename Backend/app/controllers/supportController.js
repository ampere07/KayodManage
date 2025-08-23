const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const { emitSupportUpdate } = require('../socket/socketHandlers');

// Get all support tickets
const getAllTickets = async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      category, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    if (status && status !== 'all') filters.status = status;
    if (priority && priority !== 'all') filters.priority = priority;
    if (category && category !== 'all') filters.category = category;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const tickets = await SupportTicket.find(filters)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(filters);

    res.json({
      success: true,
      tickets,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total
      }
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get single ticket
const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Accept ticket
const acceptTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.user.id; // Assuming admin authentication middleware

    const ticket = await SupportTicket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending tickets can be accepted' 
      });
    }

    ticket.status = 'accepted';
    ticket.assignedAdmin = adminId;
    ticket.assignedAdminName = req.user.username || 'Admin';
    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId);

    // Emit socket update
    emitSupportUpdate(updatedTicket, 'accepted');

    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error('Error accepting ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject ticket
const rejectTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending tickets can be rejected' 
      });
    }

    ticket.status = 'rejected';
    if (reason) {
      ticket.resolution = reason;
    }
    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId);

    // Emit socket update
    emitSupportUpdate(updatedTicket, 'rejected');

    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error('Error rejecting ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Resolve ticket
const resolveTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!['accepted', 'in_progress'].includes(ticket.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only accepted or in-progress tickets can be resolved' 
      });
    }

    ticket.status = 'resolved';
    if (resolution) {
      ticket.resolution = resolution;
    }
    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId);

    // Emit socket update
    emitSupportUpdate(updatedTicket, 'resolved');

    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error('Error resolving ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Add message to ticket
const addMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const senderId = req.user.id; // Admin ID

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const ticket = await SupportTicket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!['accepted', 'in_progress'].includes(ticket.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only send messages to accepted or in-progress tickets' 
      });
    }

    // Get admin user details - for admin panel, use session data
    const adminName = req.user?.username || 'Admin';
    
    ticket.messages.push({
      senderId: senderId.toString(),
      senderName: adminName,
      senderType: 'Admin',
      message: message.trim(),
      timestamp: new Date()
    });

    if (ticket.status === 'accepted') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId);

    // Emit socket update
    emitSupportUpdate(updatedTicket, 'message_added');

    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get support statistics for dashboard
const getSupportStats = async (req, res) => {
  try {
    const totalTickets = await SupportTicket.countDocuments();
    const pendingTickets = await SupportTicket.countDocuments({ status: 'pending' });
    const inProgressTickets = await SupportTicket.countDocuments({ 
      status: { $in: ['accepted', 'in_progress'] } 
    });
    const resolvedTickets = await SupportTicket.countDocuments({ status: 'resolved' });
    const rejectedTickets = await SupportTicket.countDocuments({ status: 'rejected' });

    // Get tickets by priority
    const urgentTickets = await SupportTicket.countDocuments({ 
      priority: 'urgent', 
      status: { $in: ['pending', 'accepted', 'in_progress'] }
    });

    // Get recent activity
    const recentActivity = await SupportTicket.find({ 
      lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).countDocuments();

    res.json({
      success: true,
      stats: {
        total: totalTickets,
        pending: pendingTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        rejected: rejectedTickets,
        urgent: urgentTickets,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching support stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAllTickets,
  getTicket,
  acceptTicket,
  rejectTicket,
  resolveTicket,
  addMessage,
  getSupportStats
};
