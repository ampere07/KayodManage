const ChatSupport = require('../models/ChatSupport');
const User = require('../models/User');
const mongoose = require('mongoose');
const { emitChatSupportUpdate } = require('../socket/socketHandlers');
const { logActivity } = require('../utils/activityLogger');

const SUPPORT_QUERY_LOGS_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.SUPPORT_QUERY_LOGS === '1';

const getAdminObjectId = (req) => {
  const adminId = req.user?.id;
  return mongoose.Types.ObjectId.isValid(adminId)
    ? new mongoose.Types.ObjectId(adminId)
    : null;
};

const buildChatSupportAccessFilter = (req) => {
  if (req.user?.role === 'superadmin') return {};

  const adminObjectId = getAdminObjectId(req);
  if (!adminObjectId) return null;

  return {
    $or: [
      { assignedTo: { $exists: false } },
      { assignedTo: null },
      { assignedTo: adminObjectId },
      {
        status: 'closed',
        'ticketHistory.resolvedBy': adminObjectId
      }
    ]
  };
};

const canAccessChatSupport = (req, chatSupport) => {
  if (req.user?.role === 'superadmin') return true;

  const adminObjectId = getAdminObjectId(req);
  if (!adminObjectId || !chatSupport) return false;

  if (!chatSupport.assignedTo) return true;
  if (chatSupport.assignedTo.toString() === adminObjectId.toString()) return true;

  return (
    chatSupport.status === 'closed' &&
    (chatSupport.ticketHistory || []).some(
      (entry) => entry.resolvedBy?.toString() === adminObjectId.toString()
    )
  );
};

const rejectInaccessibleChatSupport = (req, res, chatSupport) => {
  if (canAccessChatSupport(req, chatSupport)) return false;

  // Use 404 so ticket IDs cannot be enumerated across support agents.
  res.status(404).json({ success: false, message: 'Chat support not found' });
  return true;
};

const canModifyChatSupport = (req, chatSupport) => {
  if (req.user?.role === 'superadmin') return true;

  const adminObjectId = getAdminObjectId(req);
  return Boolean(
    adminObjectId &&
      chatSupport?.assignedTo &&
      chatSupport.assignedTo.toString() === adminObjectId.toString()
  );
};

const rejectUnownedChatSupport = (req, res, chatSupport) => {
  if (canModifyChatSupport(req, chatSupport)) return false;

  res.status(403).json({
    success: false,
    message: 'Accept this ticket before modifying it'
  });
  return true;
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
  const requestStartedAt = Date.now();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const logQuery = (stage, details) => {
    if (SUPPORT_QUERY_LOGS_ENABLED) {
      console.log(`[support:list:${requestId}] ${stage}`, details);
    }
  };

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

    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'status',
      'priority',
      'category'
    ]);
    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const sortOptions = { [safeSortBy]: sortOrder === 'asc' ? 1 : -1 };
    const accessFilter = buildChatSupportAccessFilter(req);

    if (!accessFilter) {
      return res.status(400).json({ success: false, message: 'Invalid admin ID' });
    }

    const filters = { ...accessFilter };
    if (status && status !== 'all') {
      if (status === 'pending') {
        filters.status = 'open';
        filters.acceptedBy = { $ne: null };
      } else if (status === 'resolved') {
        filters.status = 'closed';
      } else if (status === 'open' || status === 'closed') {
        filters.status = status;
      }
    }
    if (category && category !== 'all') filters.category = category;
    if (priority && priority !== 'all') filters.priority = priority;

    logQuery('start', {
      role: req.user?.role,
      page: parsedPage,
      limit: parsedLimit,
      status: status || 'all',
      category: category || 'all',
      priority: priority || 'all'
    });

    const queryStartedAt = Date.now();
    const [chatSupports, total] = await Promise.all([
      ChatSupport.find(filters)
        .sort(sortOptions)
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean()
        .maxTimeMS(15000),
      ChatSupport.countDocuments(filters).maxTimeMS(15000)
    ]);

    logQuery('tickets', {
      returned: chatSupports.length,
      total,
      ms: Date.now() - queryStartedAt
    });

    const userIds = [
      ...new Set(
        chatSupports
          .map((chat) => chat.userId?.toString())
          .filter(Boolean)
      )
    ];
    const usersStartedAt = Date.now();
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select('_id userType profileImage')
          .lean()
          .maxTimeMS(10000)
      : [];
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    logQuery('users', {
      requested: userIds.length,
      returned: users.length,
      ms: Date.now() - usersStartedAt
    });

    const chatSupportsWithUserData = chatSupports.map((chat) => {
      const supportUser = usersById.get(chat.userId?.toString());
      const displayStatus =
        chat.status === 'closed'
          ? 'resolved'
          : chat.acceptedBy
            ? 'pending'
            : 'open';

      // Live unread count — user messages the assigned admin hasn't opened
      // yet (getChatSupport marks them read). The stored schema field was
      // never written, so it always showed 0.
      const unreadCount = (chat.messages || []).filter(
        (message) => message.senderType === 'User' && !message.isRead
      ).length;

      return {
        ...chat,
        priority: chat.priority || 'medium',
        userType: supportUser?.userType || 'client',
        userProfileImage: supportUser?.profileImage || null,
        displayStatus,
        unreadCount
      };
    });

    logQuery('complete', { ms: Date.now() - requestStartedAt });

    return res.json({
      success: true,
      chatSupports: chatSupportsWithUserData,
      pagination: {
        current: parsedPage,
        total: Math.ceil(total / parsedLimit),
        count: total
      }
    });
  } catch (error) {
    console.error(
      `[support:list:${requestId}] failed after ${Date.now() - requestStartedAt}ms`,
      error
    );
    return res.status(500).json({
      success: false,
      message: 'Server error',
      ...(process.env.NODE_ENV !== 'production' ? { detail: error.message } : {})
    });
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

    if (rejectInaccessibleChatSupport(req, res, chatSupport)) return;

    // Opening the thread marks the user's messages as read — this is what
    // clears the unread badge in the ticket list.
    const hasUnread = chatSupport.messages?.some(
      (message) => message.senderType === 'User' && !message.isRead
    );
    if (hasUnread) {
      chatSupport.messages.forEach((message) => {
        if (message.senderType === 'User' && !message.isRead) {
          message.isRead = true;
        }
      });
      await chatSupport.save();
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
      priority: chatSupport.priority || 'medium',
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
    const adminObjectId = getAdminObjectId(req);
    const adminRole = req.user?.role;
    const adminName = req.admin?.name || req.user?.username || 'Support Agent';

    if (!adminObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID'
      });
    }

    const assignmentFilter =
      adminRole === 'superadmin'
        ? {}
        : {
            $or: [
              { assignedTo: { $exists: false } },
              { assignedTo: null },
              { assignedTo: adminObjectId }
            ]
          };
    const acceptedAt = new Date();
    const chatSupport = await ChatSupport.findOneAndUpdate(
      {
        _id: chatSupportId,
        status: 'open',
        acceptedBy: null,
        ...assignmentFilter
      },
      {
        $set: {
          assignedTo: adminObjectId,
          assignedToName: adminName,
          acceptedBy: adminObjectId,
          acceptedByName: adminName,
          acceptedAt
        },
        $push: {
          messages: {
            senderId: adminObjectId,
            senderName: adminName,
            senderType: 'Admin',
            message: 'Ticket has been accepted',
            timestamp: acceptedAt,
            isRead: true
          }
        }
      },
      { new: true, runValidators: true }
    ).populate('userId', 'userType profileImage');

    if (!chatSupport) {
      const current = await ChatSupport.findById(chatSupportId)
        .select('status acceptedBy assignedTo')
        .lean();

      if (!current) {
        return res.status(404).json({
          success: false,
          message: 'Chat support not found'
        });
      }
      if (current.status !== 'open') {
        return res.status(409).json({
          success: false,
          message: 'Only open tickets can be accepted'
        });
      }

      return res.status(409).json({
        success: false,
        message: 'This ticket has already been accepted by another admin'
      });
    }

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
            adminUsername: req.user?.username,
            subject: chatSupport.subject
          },
          ipAddress: req.ip
        }
      );
    } catch (activityError) {
      console.error('Error logging support acceptance:', activityError);
    }

    emitChatSupportUpdate(chatSupport._id, {
      status: chatSupport.status,
      assignedTo: chatSupport.assignedTo,
      assignedToName: chatSupport.assignedToName,
      acceptedBy: chatSupport.acceptedBy,
      acceptedByName: chatSupport.acceptedByName,
      acceptedAt: chatSupport.acceptedAt,
      messages: chatSupport.messages,
      updatedAt: chatSupport.updatedAt
    });

    return res.json({
      success: true,
      chatSupport: {
        ...chatSupport.toObject(),
        priority: chatSupport.priority || 'medium',
        userType: chatSupport.userId?.userType || 'client',
        userProfileImage: chatSupport.userId?.profileImage || null,
        displayStatus: 'pending'
      }
    });
  } catch (error) {
    console.error('Error accepting chat support:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
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

    if (rejectUnownedChatSupport(req, res, chatSupport)) return;

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
      chatSupport.assignedToName = req.admin?.name || req.user?.username || 'Support Agent';
    }

    if (!chatSupport.statusHistory) {
      chatSupport.statusHistory = [];
    }
    chatSupport.statusHistory.push({
      status: 'resolved',
      performedBy: adminObjectId,
      performedByName: req.admin?.name || req.user?.username || 'Support Agent',
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
      senderName: req.admin?.name || req.user?.username || 'Support Agent',
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

    if (rejectUnownedChatSupport(req, res, chatSupport)) return;

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
      performedByName: req.admin?.name || req.user?.username || 'Support Agent',
      timestamp: new Date()
    });

    const adminId = req.user?.id || '000000000000000000000000';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId)
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');

    chatSupport.messages.push({
      senderId: adminObjectId,
      senderName: req.admin?.name || req.user?.username || 'Support Agent',
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

    if (rejectUnownedChatSupport(req, res, chatSupport)) return;

    if (chatSupport.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Can only send messages to open chats'
      });
    }

    const adminName = req.admin?.name || req.user?.username || 'Support Agent';
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

// Add an internal, admin-only note to a chat support thread — used for
// dispute mediation reasoning that should never reach the customer (see
// isInternal on ChatSupport.messages, and stripInternalMessages on
// kayod/server's user-facing endpoints, which filter these out).
const addInternalNote = async (req, res) => {
  try {
    const { chatSupportId } = req.params;
    const { note } = req.body;
    const adminId = req.user?.id || '000000000000000000000000';
    const adminRole = req.user?.role;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note is required' });
    }

    if (adminRole !== 'admin' && adminRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can add internal notes'
      });
    }

    const chatSupport = await ChatSupport.findById(chatSupportId);

    if (!chatSupport) {
      return res.status(404).json({ success: false, message: 'Chat support not found' });
    }

    if (rejectUnownedChatSupport(req, res, chatSupport)) return;

    const adminName = req.admin?.name || req.user?.username || 'Support Agent';
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId)
      ? new mongoose.Types.ObjectId(adminId)
      : new mongoose.Types.ObjectId('000000000000000000000000');

    chatSupport.messages.push({
      senderId: adminObjectId,
      senderName: adminName,
      senderType: 'Admin',
      message: note.trim(),
      isInternal: true,
      timestamp: new Date()
    });

    await chatSupport.save();

    res.json({ success: true, chatSupport });
  } catch (error) {
    console.error('Error adding internal note:', error);
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
  getSupportStats,
  getAllChatSupports,
  getChatSupport,
  acceptChatSupport,
  closeChatSupport,
  reopenChatSupport,
  addChatSupportMessage,
  addInternalNote,
  broadcastMobileMessage
};
