const ChatSupport = require('../models/ChatSupport');
const User = require('../models/User');
const { emitSupportUpdate, emitChatSupportUpdate, emitNewChatSupport } = require('../socket/socketHandlers');
const { logActivity } = require('../utils/activityLogger');

// Get all chat support conversations
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
    
    if (status && status !== 'all') {
      if (status === 'pending' || status === 'accepted' || status === 'in_progress') {
        filters.status = 'open';
      } else if (status === 'resolved' || status === 'closed' || status === 'rejected') {
        filters.status = 'closed';
      }
    }
    
    if (category && category !== 'all') filters.category = category;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const chatSupports = await ChatSupport.find(filters)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ChatSupport.countDocuments(filters);

    const tickets = chatSupports.map(chat => ({
      _id: chat._id,
      ticketId: `CHAT-${chat._id.toString().slice(-8).toUpperCase()}`,
      userId: chat.userId.toString(),
      userEmail: chat.userEmail,
      userName: chat.userName,
      title: chat.subject,
      description: chat.messages[0]?.message || '',
      category: chat.category,
      priority: 'medium',
      status: chat.status === 'open' ? 'in_progress' : 'closed',
      messages: chat.messages,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }));

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
    console.error('Error fetching chat supports:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get single chat support
const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const chatSupport = await ChatSupport.findById(ticketId);

    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    const ticket = {
      _id: chatSupport._id,
      ticketId: `CHAT-${chatSupport._id.toString().slice(-8).toUpperCase()}`,
      userId: chatSupport.userId.toString(),
      userEmail: chatSupport.userEmail,
      userName: chatSupport.userName,
      title: chatSupport.subject,
      description: chatSupport.messages[0]?.message || '',
      category: chatSupport.category,
      priority: 'medium',
      status: chatSupport.status === 'open' ? 'in_progress' : 'closed',
      messages: chatSupport.messages,
      createdAt: chatSupport.createdAt,
      updatedAt: chatSupport.updatedAt
    };

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error fetching chat support:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Accept ticket (no-op for chat support, already open)
const acceptTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.user.id;

    const chatSupport = await ChatSupport.findById(ticketId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only open chats can be accepted' 
      });
    }

    const ticket = {
      _id: chatSupport._id,
      ticketId: `CHAT-${chatSupport._id.toString().slice(-8).toUpperCase()}`,
      userId: chatSupport.userId.toString(),
      userEmail: chatSupport.userEmail,
      userName: chatSupport.userName,
      title: chatSupport.subject,
      description: chatSupport.messages[0]?.message || '',
      category: chatSupport.category,
      priority: 'medium',
      status: 'accepted',
      messages: chatSupport.messages,
      createdAt: chatSupport.createdAt,
      updatedAt: chatSupport.updatedAt
    };

    emitSupportUpdate(ticket, 'accepted');

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error accepting chat:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject ticket (close chat support)
const rejectTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;

    const chatSupport = await ChatSupport.findById(ticketId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only open chats can be rejected' 
      });
    }

    chatSupport.status = 'closed';
    chatSupport.closedAt = new Date();
    
    // Add to status history
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'resolved',
      performedBy: req.user?.id,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date(),
      reason: reason || 'Ticket resolved'
    });
    
    // Always add a message to the chat when ticket is rejected/closed
    const mongoose = require('mongoose');
    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');
    
    const rejectMessage = reason 
      ? `Ticket has been closed: ${reason}`
      : 'Ticket has been closed';
    
    chatSupport.messages.push({
      senderId: adminObjectId,
      senderName: req.user?.username || 'Support Agent',
      senderType: 'Admin',
      message: rejectMessage,
      timestamp: new Date()
    });
    
    await chatSupport.save();

    const ticket = {
      _id: chatSupport._id,
      ticketId: `CHAT-${chatSupport._id.toString().slice(-8).toUpperCase()}`,
      userId: chatSupport.userId.toString(),
      userEmail: chatSupport.userEmail,
      userName: chatSupport.userName,
      title: chatSupport.subject,
      description: chatSupport.messages[0]?.message || '',
      category: chatSupport.category,
      priority: 'medium',
      status: 'rejected',
      messages: chatSupport.messages,
      createdAt: chatSupport.createdAt,
      updatedAt: chatSupport.updatedAt
    };

    emitSupportUpdate(ticket, 'rejected');

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error rejecting chat:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Resolve ticket (close chat support)
const resolveTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution } = req.body;

    const chatSupport = await ChatSupport.findById(ticketId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only open chats can be resolved' 
      });
    }

    chatSupport.status = 'closed';
    chatSupport.closedAt = new Date();
    
    // Add to status history
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'resolved',
      performedBy: req.user?.id,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date(),
      reason: resolution || 'Ticket resolved'
    });
    
    // Always add a message to the chat when ticket is resolved
    const mongoose = require('mongoose');
    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');
    
    const resolveMessage = resolution 
      ? `Ticket has been resolved: ${resolution}`
      : 'Ticket has been resolved';
    
    chatSupport.messages.push({
      senderId: adminObjectId,
      senderName: req.user?.username || 'Support Agent',
      senderType: 'Admin',
      message: resolveMessage,
      timestamp: new Date()
    });
    
    await chatSupport.save();

    const ticket = {
      _id: chatSupport._id,
      ticketId: `CHAT-${chatSupport._id.toString().slice(-8).toUpperCase()}`,
      userId: chatSupport.userId.toString(),
      userEmail: chatSupport.userEmail,
      userName: chatSupport.userName,
      title: chatSupport.subject,
      description: chatSupport.messages[0]?.message || '',
      category: chatSupport.category,
      priority: 'medium',
      status: 'resolved',
      messages: chatSupport.messages,
      createdAt: chatSupport.createdAt,
      updatedAt: chatSupport.updatedAt
    };

    emitSupportUpdate(ticket, 'resolved');

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error resolving chat:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Add message to chat support
const addMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const adminId = req.user?.id || '000000000000000000000000';

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const chatSupport = await ChatSupport.findById(ticketId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only send messages to open chats' 
      });
    }

    const adminName = req.user?.username || 'Support Agent';
    
    const mongoose = require('mongoose');
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');
    
    const newMessage = {
      senderId: adminObjectId,
      senderName: adminName,
      senderType: 'Admin',
      message: message.trim(),
      timestamp: new Date()
    };
    
    chatSupport.messages.push(newMessage);
    await chatSupport.save();

    const ticket = {
      _id: chatSupport._id,
      ticketId: `CHAT-${chatSupport._id.toString().slice(-8).toUpperCase()}`,
      userId: chatSupport.userId.toString(),
      userEmail: chatSupport.userEmail,
      userName: chatSupport.userName,
      title: chatSupport.subject,
      description: chatSupport.messages[0]?.message || '',
      category: chatSupport.category,
      priority: 'medium',
      status: 'in_progress',
      messages: chatSupport.messages,
      createdAt: chatSupport.createdAt,
      updatedAt: chatSupport.updatedAt
    };

    emitSupportUpdate(ticket, 'message_added');

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Get support statistics for dashboard
const getSupportStats = async (req, res) => {
  try {
    const totalTickets = await ChatSupport.countDocuments();
    const pendingTickets = await ChatSupport.countDocuments({ status: 'open' });
    const inProgressTickets = await ChatSupport.countDocuments({ status: 'open' });
    const resolvedTickets = await ChatSupport.countDocuments({ status: 'closed' });
    const rejectedTickets = 0;

    const urgentTickets = 0;

    const recentActivity = await ChatSupport.find({ 
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
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

// Get all chat supports
const getAllChatSupports = async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      category, 
      page = 1, 
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    
    if (status && status !== 'all') filters.status = status;
    if (category && category !== 'all') filters.category = category;
    if (priority && priority !== 'all') filters.priority = priority;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const chatSupports = await ChatSupport.find(filters)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'userType profileImage');

    const total = await ChatSupport.countDocuments(filters);

    // Map and include userType and profileImage
    const chatSupportsWithUserData = chatSupports.map(chat => ({
      ...chat.toObject(),
      userType: chat.userId?.userType || 'client',
      userProfileImage: chat.userId?.profileImage || null
    }));

    res.json({
      success: true,
      chatSupports: chatSupportsWithUserData,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total
      }
    });
  } catch (error) {
    console.error('Error fetching chat supports:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get single chat support
const getChatSupport = async (req, res) => {
  try {
    const { chatSupportId } = req.params;
    
    const chatSupport = await ChatSupport.findById(chatSupportId)
      .populate('userId', 'userType profileImage');

    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    // Include userType and profileImage in response
    const chatSupportWithUserData = {
      ...chatSupport.toObject(),
      userType: chatSupport.userId?.userType || 'client',
      userProfileImage: chatSupport.userId?.profileImage || null
    };

    res.json({ success: true, chatSupport: chatSupportWithUserData });
  } catch (error) {
    console.error('Error fetching chat support:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Accept chat support
const acceptChatSupport = async (req, res) => {
  try {
    const { chatSupportId } = req.params;
    const adminId = req.user?.id || '000000000000000000000000';

    const chatSupport = await ChatSupport.findById(chatSupportId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only open chats can be accepted' 
      });
    }

    // Check if already assigned
    if (chatSupport.assignedTo || chatSupport.acceptedBy) {
      return res.status(400).json({ 
        success: false, 
        message: 'This ticket has already been accepted by another admin' 
      });
    }

    const mongoose = require('mongoose');
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');

    // Update chat support with admin assignment
    chatSupport.assignedTo = adminObjectId;
    chatSupport.acceptedBy = adminObjectId;
    chatSupport.acceptedAt = new Date();
    
    await chatSupport.save();

    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'support_accepted',
        `Accepted support ticket: ${chatSupport.subject}`,
        {
          targetType: 'support',
          targetId: chatSupportId,
          targetModel: 'ChatSupport',
          metadata: { userName: chatSupport.userName },
          ipAddress: req.ip
        }
      );
    }

    emitChatSupportUpdate(chatSupport, { 
      assignedTo: adminObjectId, 
      acceptedBy: adminObjectId,
      acceptedAt: chatSupport.acceptedAt 
    });

    res.json({ success: true, chatSupport });
  } catch (error) {
    console.error('Error accepting chat support:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Close chat support
const closeChatSupport = async (req, res) => {
  try {
    const { chatSupportId } = req.params;
    const { reason } = req.body;

    const chatSupport = await ChatSupport.findById(chatSupportId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only open chats can be closed' 
      });
    }

    chatSupport.status = 'closed';
    chatSupport.closedAt = new Date();
    
    // Add to status history
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'resolved',
      performedBy: req.user?.id,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date(),
      reason: reason || 'Ticket closed'
    });
    
    // Always add a message to the chat when ticket is closed
    const mongoose = require('mongoose');
    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');
    
    const closeMessage = reason 
      ? `Ticket has been resolved: ${reason}`
      : 'Ticket has been resolved';
    
    chatSupport.messages.push({
      senderId: adminObjectId,
      senderName: req.user?.username || 'Support Agent',
      senderType: 'Admin',
      message: closeMessage,
      timestamp: new Date()
    });
    
    await chatSupport.save();

    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'support_closed',
        `Closed support ticket: ${chatSupport.subject}`,
        {
          targetType: 'support',
          targetId: chatSupportId,
          targetModel: 'ChatSupport',
          metadata: { reason, userName: chatSupport.userName },
          ipAddress: req.ip
        }
      );
    }

    emitChatSupportUpdate(chatSupport, { status: 'closed', closedAt: chatSupport.closedAt });

    res.json({ success: true, chatSupport });
  } catch (error) {
    console.error('Error closing chat:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Reopen chat support
const reopenChatSupport = async (req, res) => {
  try {
    const { chatSupportId } = req.params;

    const chatSupport = await ChatSupport.findById(chatSupportId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'closed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only closed chats can be reopened' 
      });
    }

    chatSupport.status = 'open';
    // Keep closedAt to preserve history - don't set to undefined
    
    // Add to status history
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'reopened',
      performedBy: req.user?.id,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date()
    });
    
    const mongoose = require('mongoose');
    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');
    
    chatSupport.messages.push({
      senderId: adminObjectId,
      senderName: req.user?.username || 'Support Agent',
      senderType: 'Admin',
      message: 'Chat has been reopened',
      timestamp: new Date()
    });
    
    await chatSupport.save();

    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'support_reopened',
        `Reopened support ticket: ${chatSupport.subject}`,
        {
          targetType: 'support',
          targetId: chatSupportId,
          targetModel: 'ChatSupport',
          metadata: { userName: chatSupport.userName },
          ipAddress: req.ip
        }
      );
    }

    emitChatSupportUpdate(chatSupport, { status: 'open' });

    res.json({ success: true, chatSupport });
  } catch (error) {
    console.error('Error reopening chat:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Add message to chat support
const addChatSupportMessage = async (req, res) => {
  try {
    const { chatSupportId } = req.params;
    const { message } = req.body;
    const adminId = req.user?.id || '000000000000000000000000';

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const chatSupport = await ChatSupport.findById(chatSupportId);
    
    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only send messages to open chats' 
      });
    }

    const adminName = req.user?.username || 'Support Agent';
    
    const mongoose = require('mongoose');
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');
    
    const newMessage = {
      senderId: adminObjectId,
      senderName: adminName,
      senderType: 'Admin',
      message: message.trim(),
      timestamp: new Date()
    };
    
    chatSupport.messages.push(newMessage);
    await chatSupport.save();

    const savedMessage = chatSupport.messages[chatSupport.messages.length - 1];

    res.json({ success: true, message: savedMessage, chatSupport });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

const broadcastMobileMessage = async (req, res) => {
  try {
    const { chatSupportId, message } = req.body;

    if (!chatSupportId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Chat support ID and message are required'
      });
    }

    console.log('📨 Received mobile message for broadcast:', { chatSupportId, message });

    const { emitChatSupportMessage } = require('../socket/socketHandlers');
    emitChatSupportMessage(chatSupportId, message);

    res.json({
      success: true,
      message: 'Message broadcasted to admin panel'
    });
  } catch (error) {
    console.error('Error broadcasting mobile message:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

module.exports = {
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
};
