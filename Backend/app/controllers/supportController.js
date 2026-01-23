const ChatSupport = require('../models/ChatSupport');
const User = require('../models/User');
const mongoose = require('mongoose');
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

    const totalPromise = ChatSupport.countDocuments(filters);
    const total = await totalPromise;

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
    
    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : null;
    
    if (!chatSupport.assignedTo && adminObjectId) {
      chatSupport.assignedTo = adminObjectId;
      chatSupport.assignedToName = req.user?.username || 'Support Agent';
    }
    
    if (chatSupport.ticketHistory && chatSupport.ticketHistory.length > 0) {
      const lastTicket = chatSupport.ticketHistory[chatSupport.ticketHistory.length - 1];
      if (!lastTicket.closedAt) {
        lastTicket.closedAt = new Date();
        lastTicket.resolvedBy = adminObjectId;
      }
    }
    
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'resolved',
      performedBy: adminObjectId,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date(),
      reason: reason || 'Ticket resolved'
    });
    
    const adminMsgObjectId = adminObjectId || new mongoose.Types.ObjectId('000000000000000000000000');
    
    const rejectMessage = reason 
      ? `Ticket has been closed: ${reason}`
      : 'Ticket has been closed';
    
    chatSupport.messages.push({
      senderId: adminMsgObjectId,
      senderName: req.user?.username || 'Support Agent',
      senderType: 'Admin',
      message: rejectMessage,
      timestamp: new Date()
    });
    
    await chatSupport.save();
    console.log(`✅ Ticket ${ticketId} rejected - status: ${chatSupport.status}`);

    if (adminObjectId) {
      try {
        await User.findByIdAndUpdate(
          adminObjectId,
          { $inc: { ticketsResolved: 1 } },
          { new: true }
        );
        console.log(`✅ Incremented ticketsResolved for admin ${adminObjectId}`);
      } catch (updateError) {
        console.error('❌ Error updating admin ticketsResolved:', updateError);
      }
    }

    if (chatSupport.userId) {
      try {
        await User.findByIdAndUpdate(
          chatSupport.userId,
          { $inc: { ticketsSubmittedResolved: 1 } },
          { new: true }
        );
        console.log(`✅ Incremented ticketsSubmittedResolved for user ${chatSupport.userId}`);
      } catch (updateError) {
        console.error('❌ Error updating user ticketsSubmittedResolved:', updateError);
      }
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
    
    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : null;
    
    if (!chatSupport.assignedTo && adminObjectId) {
      chatSupport.assignedTo = adminObjectId;
      chatSupport.assignedToName = req.user?.username || 'Support Agent';
    }
    
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'resolved',
      performedBy: adminObjectId,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date(),
      reason: resolution || 'Ticket resolved'
    });
    
    const adminMsgObjectId = adminObjectId || new mongoose.Types.ObjectId('000000000000000000000000');
    
    const resolveMessage = resolution 
      ? `Ticket has been resolved: ${resolution}`
      : 'Ticket has been resolved';
    
    chatSupport.messages.push({
      senderId: adminMsgObjectId,
      senderName: req.user?.username || 'Support Agent',
      senderType: 'Admin',
      message: resolveMessage,
      timestamp: new Date()
    });
    
    await chatSupport.save();
    console.log(`✅ Ticket ${ticketId} resolved - status: ${chatSupport.status}`);

    if (adminObjectId) {
      try {
        await User.findByIdAndUpdate(
          adminObjectId,
          { $inc: { ticketsResolved: 1 } },
          { new: true }
        );
        console.log(`✅ Incremented ticketsResolved for admin ${adminObjectId}`);
      } catch (updateError) {
        console.error('❌ Error updating admin ticketsResolved:', updateError);
      }
    }

    if (chatSupport.userId) {
      try {
        await User.findByIdAndUpdate(
          chatSupport.userId,
          { $inc: { ticketsSubmittedResolved: 1 } },
          { new: true }
        );
        console.log(`✅ Incremented ticketsSubmittedResolved for user ${chatSupport.userId}`);
      } catch (updateError) {
        console.error('❌ Error updating user ticketsSubmittedResolved:', updateError);
      }
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

    const adminId = req.user.id;
    const adminRole = req.user.role;
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : null;

    if (!adminObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid admin ID' });
    }

    let baseFilters;
    
    // Superadmins can see ALL tickets
    if (adminRole === 'superadmin') {
      baseFilters = {};
    } else {
      // Regular admins can only see unassigned tickets or tickets assigned to them
      baseFilters = {
        $or: [
          { assignedTo: { $exists: false } },
          { assignedTo: null },
          { assignedTo: adminObjectId }
        ]
      };
    }
    
    const myTickets = await ChatSupport.find(baseFilters).select('userId');
    const userIds = [...new Set(myTickets.map(t => t.userId.toString()))];
    
    let filters;
    // Superadmins see everything
    if (adminRole === 'superadmin') {
      filters = {};
    } else {
      // Regular admins see unassigned, assigned to them, or from users they've helped
      filters = {
        $or: [
          { assignedTo: { $exists: false } },
          { assignedTo: null },
          { assignedTo: adminObjectId },
          { userId: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } },
          { 'ticketHistory.resolvedBy': adminObjectId }
        ]
      };
    }
    
    // Apply additional filters (status, category, priority) for all roles
    if (status && status !== 'all') filters.status = status;
    if (category && category !== 'all') filters.category = category;
    if (priority && priority !== 'all') filters.priority = priority;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const chatSupports = await ChatSupport.find(filters)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'userType profileImage')
      .lean();

    const total = await ChatSupport.countDocuments(filters);

    // Map and include userType, profileImage, and displayStatus
    const chatSupportsWithUserData = chatSupports.map(chat => {
      let displayStatus = 'open';
      if (chat.status === 'closed') {
        displayStatus = 'resolved';
      } else if (chat.status === 'open') {
        displayStatus = chat.acceptedBy ? 'pending' : 'open';
      }

      return {
        ...chat,
        userType: chat.userId?.userType || 'client',
        userProfileImage: chat.userId?.profileImage || null,
        displayStatus
      };
    });

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

    // Include userType, profileImage, and displayStatus in response
    let displayStatus = 'open';
    if (chatSupport.status === 'closed') {
      displayStatus = 'resolved';
    } else if (chatSupport.status === 'open') {
      displayStatus = chatSupport.acceptedBy ? 'pending' : 'open';
    }

    const chatSupportObj = chatSupport.toObject ? chatSupport.toObject() : chatSupport;
    const chatSupportWithUserData = {
      ...chatSupportObj,
      userType: chatSupport.userId?.userType || 'client',
      userProfileImage: chatSupport.userId?.profileImage || null,
      displayStatus
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

    console.log('🔍 Accepting ticket:', { chatSupportId, adminId, user: req.user });

    const chatSupport = await ChatSupport.findById(chatSupportId);
    
    console.log('📝 Found chat support:', chatSupport ? 'YES' : 'NO');
    
    if (!chatSupport) {
      console.log('❌ Chat support not found');
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (chatSupport.status !== 'open') {
      console.log('❌ Status not open:', chatSupport.status);
      return res.status(400).json({ 
        success: false, 
        message: 'Only open chats can be accepted' 
      });
    }

    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : null;

    console.log('🔑 Admin ObjectId:', adminObjectId?.toString());

    if (!adminObjectId) {
      console.log('❌ Invalid admin ID');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid admin ID' 
      });
    }

    // Check if user is an admin (allow both admin and superadmin)
    const adminRole = req.user?.role;
    const adminUsername = req.user?.username;
    
    console.log('👤 Admin from session:', { username: adminUsername, role: adminRole });
    
    if (!adminUsername || !adminRole) {
      console.log('❌ Admin session data incomplete');
      return res.status(401).json({ 
        success: false, 
        message: 'Admin session data incomplete' 
      });
    }

    if (adminRole !== 'admin' && adminRole !== 'superadmin') {
      console.log('❌ Not an admin or superadmin:', adminRole);
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can accept tickets.' 
      });
    }

    // Regular admins cannot take tickets assigned to others, but superadmins can
    if (adminRole !== 'superadmin' && chatSupport.assignedTo && !chatSupport.assignedTo.equals(adminObjectId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'This ticket is already assigned to another admin' 
      });
    }

    // Check if already accepted
    if (chatSupport.acceptedBy) {
      return res.status(400).json({ 
        success: false, 
        message: 'This ticket has already been accepted' 
      });
    }

    // Accept the ticket
    chatSupport.assignedTo = adminObjectId;
    chatSupport.assignedToName = adminUsername;
    chatSupport.acceptedBy = adminObjectId;
    chatSupport.acceptedByName = adminUsername;
    chatSupport.acceptedAt = new Date();
    
    await chatSupport.save();

    console.log(`✅ Ticket ${chatSupportId} accepted by admin ${adminObjectId.toString()} (${adminUsername})`);
    console.log(`Ticket assignedTo: ${chatSupport.assignedTo.toString()}, acceptedBy: ${chatSupport.acceptedBy.toString()}`);

    // Log activity - ALWAYS log this action
    try {
      await logActivity(
        adminObjectId.toString(),
        'support_accepted',
        `Accepted support ticket: ${chatSupport.subject}`,
        {
          targetType: 'support',
          targetId: chatSupportId,
          targetModel: 'ChatSupport',
          metadata: { 
            ticketId: chatSupport.ticketId,
            userName: chatSupport.userName,
            adminUsername: adminUsername,
            subject: chatSupport.subject
          },
          ipAddress: req.ip
        }
      );
      console.log('✅ Activity logged successfully');
    } catch (activityError) {
      console.error('❌ Error logging activity:', activityError);
      // Continue even if activity logging fails
    }

    const freshChatSupport = await ChatSupport.findById(chatSupportId)
      .populate('userId', 'userType profileImage')
      .lean();

    console.log('Emitting socket update with status:', freshChatSupport.status);
    emitChatSupportUpdate(freshChatSupport._id, { 
      status: freshChatSupport.status,
      assignedTo: freshChatSupport.assignedTo,
      assignedToName: freshChatSupport.assignedToName,
      acceptedBy: freshChatSupport.acceptedBy,
      acceptedByName: freshChatSupport.acceptedByName,
      acceptedAt: freshChatSupport.acceptedAt,
      updatedAt: freshChatSupport.updatedAt
    });

    res.json({ success: true, chatSupport: freshChatSupport });
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
    const adminRole = req.user?.role;

    if (adminRole !== 'admin' && adminRole !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can close tickets' 
      });
    }

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

    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : null;

    chatSupport.status = 'closed';
    chatSupport.closedAt = new Date();
    
    if (!chatSupport.assignedTo && adminObjectId) {
      chatSupport.assignedTo = adminObjectId;
      chatSupport.assignedToName = req.user?.username || 'Support Agent';
    }
    
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'resolved',
      performedBy: adminObjectId,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date(),
      reason: reason || 'Ticket closed'
    });
    
    const adminMsgObjectId = mongoose.Types.ObjectId.isValid(adminId) 
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');
    
    const closeMessage = reason 
      ? `Ticket has been resolved: ${reason}`
      : 'Ticket has been resolved';
    
    chatSupport.messages.push({
      senderId: adminMsgObjectId,
      senderName: req.user?.username || 'Support Agent',
      senderType: 'Admin',
      message: closeMessage,
      timestamp: new Date()
    });
    
    await chatSupport.save();
    console.log(`✅ Ticket ${chatSupportId} closed - status: ${chatSupport.status}`);

    if (adminObjectId) {
      try {
        await User.findByIdAndUpdate(
          adminObjectId,
          { $inc: { ticketsResolved: 1 } },
          { new: true }
        );
        console.log(`✅ Incremented ticketsResolved for admin ${adminObjectId}`);
      } catch (updateError) {
        console.error('❌ Error updating admin ticketsResolved:', updateError);
      }
    }

    if (chatSupport.userId) {
      try {
        await User.findByIdAndUpdate(
          chatSupport.userId,
          { $inc: { ticketsSubmittedResolved: 1 } },
          { new: true }
        );
        console.log(`✅ Incremented ticketsSubmittedResolved for user ${chatSupport.userId}`);
      } catch (updateError) {
        console.error('❌ Error updating user ticketsSubmittedResolved:', updateError);
      }
    }

    try {
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
      console.log('✅ Activity logged: Ticket closed');
    } catch (activityError) {
      console.error('❌ Error logging activity:', activityError);
    }

    const freshChatSupport = await ChatSupport.findById(chatSupportId)
      .populate('userId', 'userType profileImage')
      .lean();

    console.log('Emitting socket update with status:', freshChatSupport.status);
    emitChatSupportUpdate(freshChatSupport._id, { 
      status: freshChatSupport.status, 
      closedAt: freshChatSupport.closedAt,
      updatedAt: freshChatSupport.updatedAt,
      messages: freshChatSupport.messages,
      statusHistory: freshChatSupport.statusHistory
    });

    res.json({ success: true, chatSupport: freshChatSupport });
  } catch (error) {
    console.error('Error closing chat:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Reopen chat support
const reopenChatSupport = async (req, res) => {
  try {
    const { chatSupportId } = req.params;
    const adminRole = req.user?.role;

    if (adminRole !== 'admin' && adminRole !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can reopen tickets' 
      });
    }

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
    chatSupport.closedAt = null;
    
    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'reopened',
      performedBy: req.user?.id,
      performedByName: req.user?.username || 'Support Agent',
      timestamp: new Date()
    });
    
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
    console.log(`✅ Ticket ${chatSupportId} reopened - status: ${chatSupport.status}`);

    try {
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
      console.log('✅ Activity logged: Ticket reopened');
    } catch (activityError) {
      console.error('❌ Error logging activity:', activityError);
    }

    const freshChatSupport = await ChatSupport.findById(chatSupportId)
      .populate('userId', 'userType profileImage')
      .lean();

    console.log('Emitting socket update with status:', freshChatSupport.status);
    emitChatSupportUpdate(freshChatSupport._id, { 
      status: freshChatSupport.status,
      closedAt: freshChatSupport.closedAt,
      updatedAt: freshChatSupport.updatedAt,
      messages: freshChatSupport.messages,
      statusHistory: freshChatSupport.statusHistory
    });

    res.json({ success: true, chatSupport: freshChatSupport });
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
    const adminRole = req.user?.role;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Allow both admin and superadmin to send messages
    if (adminRole !== 'admin' && adminRole !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can send messages to tickets' 
      });
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
