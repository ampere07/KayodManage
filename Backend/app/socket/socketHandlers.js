const User = require('../models/User');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityFeed = require('../models/ActivityFeed');
const Alert = require('../models/Alert');
const ChatSupport = require('../models/ChatSupport');
const ReportedPost = require('../models/ReportedPost');
const CredentialVerification = require('../models/CredentialVerification');
const FeeRecord = require('../models/FeeRecord');
const mongoose = require('mongoose');

let adminNamespace = null;
let chatSupportChangeStream = null;
let activeIntervals = new Map();

const canViewSupportChat = (chatSupport, adminId, adminRole) => {
  if (adminRole === 'superadmin') return true;
  if (!chatSupport?.assignedTo) return true;
  if (chatSupport.assignedTo.toString() === adminId) return true;

  return (
    chatSupport.status === 'closed' &&
    (chatSupport.ticketHistory || []).some(
      (entry) => entry.resolvedBy?.toString() === adminId
    )
  );
};

const setupSocketHandlers = (io) => {
  adminNamespace = io.of('/admin');
  
  // Store main io instance for use in change stream
  global.io = io;

  adminNamespace.use(async (socket, next) => {
    try {
      const session = socket.request.session;
      if (
        !session?.isAuthenticated ||
        !session.adminId ||
        !['admin', 'superadmin'].includes(session.role)
      ) {
        return next(new Error('Unauthorized'));
      }

      const admin = await User.findById(session.adminId)
        .select('_id name email userType accountStatus')
        .lean();
      if (
        !admin ||
        admin.accountStatus !== 'active' ||
        !['admin', 'superadmin'].includes(admin.userType)
      ) {
        return next(new Error('Unauthorized'));
      }

      socket.data.adminId = admin._id.toString();
      socket.data.adminRole = admin.userType;
      return next();
    } catch (error) {
      console.error('Admin socket authentication failed:', error.message);
      return next(new Error('Unauthorized'));
    }
  });

  setupChatSupportChangeStream();

  adminNamespace.on('connection', async (socket) => {
    const { adminId, adminRole } = socket.data;
    socket.join('admin');
    socket.emit('connection:status', 'connected');

    await sendInitialData(socket, adminId);
    setupRealtimeIntervals(socket, adminId);

    socket.on('request:dashboard', () => broadcastDashboardStats());
    socket.on('request:alerts', async () => {
      const alerts = await getActiveAlerts(adminId);
      socket.emit('alerts:update', { alerts, timestamp: new Date() });
    });

    socket.on('test:ping', (data) => {
      socket.emit('test:pong', {
        message: 'Socket connection working!',
        page: data?.page
      });
    });

    socket.on('support:join_chat', async (data = {}) => {
      const chatSupportId = data.chatSupportId;
      if (!mongoose.isValidObjectId(chatSupportId)) {
        socket.emit('support:join_error', {
          error: 'Invalid chat support ID',
          chatSupportId
        });
        return;
      }

      try {
        const chatSupport = await ChatSupport.findById(chatSupportId)
          .select('assignedTo status ticketHistory.resolvedBy')
          .lean();
        if (!chatSupport || !canViewSupportChat(chatSupport, adminId, adminRole)) {
          socket.emit('support:join_error', {
            error: 'Chat support not found',
            chatSupportId
          });
          return;
        }

        socket.join(`support:${chatSupportId}`);
        socket.emit('support:joined_chat', { chatSupportId });
      } catch (error) {
        console.error('Error joining support chat:', error.message);
        socket.emit('support:join_error', {
          error: 'Failed to join support chat',
          chatSupportId
        });
      }
    });

    socket.on('support:leave_chat', (data = {}) => {
      if (data.chatSupportId) {
        socket.leave(`support:${data.chatSupportId}`);
      }
    });

    socket.on('disconnect', () => {
      const intervals = activeIntervals.get(socket.id);
      if (intervals) {
        Object.values(intervals).forEach((interval) => clearInterval(interval));
        activeIntervals.delete(socket.id);
      }
    });
  });

  return adminNamespace;
};

const sendInitialData = async (socket, adminId) => {
  try {
    const stats = await getRealtimeStats();
    socket.emit('stats:initial', stats);

    const alerts = await getActiveAlerts(adminId);
    socket.emit('alerts:initial', alerts);
  } catch (error) {
    // Silently handle errors
  }
};

const setupRealtimeIntervals = (socket, adminId) => {
  const intervals = {};

  intervals.stats = setInterval(async () => {
    await broadcastDashboardStats();
  }, 5000);

  intervals.alerts = setInterval(async () => {
    const alerts = await getActiveAlerts(adminId);
    socket.emit('alerts:update', {
      alerts,
      timestamp: new Date()
    });
  }, 20000);

  activeIntervals.set(socket.id, intervals);

  return intervals;
};

const broadcastDashboardStats = async () => {
  try {
    const stats = await getRealtimeStats();
    if (adminNamespace) {
      adminNamespace.to('admin').emit('stats:update', stats);
    }
  } catch (error) {
    // Silently handle errors to avoid console spam
  }
};

const getRealtimeStats = async () => {
  try {
    const mongoose = require('mongoose');

    // Check if database is connected before querying
    if (mongoose.connection.readyState !== 1) {
      return { timestamp: new Date() };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalUsers = await User.countDocuments();
    const customers = await User.countDocuments({ userType: 'client' });
    const providers = await User.countDocuments({ userType: 'provider' });
    const activeJobs = await Job.countDocuments({ status: { $in: ['open', 'in_progress'] } });
    const onlineUsers = await User.countDocuments({ isOnline: true });
    const completedTransactions = await Transaction.find({ status: 'completed' });

    // Get pending fees from FeeRecord collection
    const pendingFeeRecords = await FeeRecord.find({
      status: { $in: ['pending', 'overdue'] }
    });

    const newUsersToday = await User.countDocuments({
      userType: 'client',
      createdAt: { $gte: today }
    });
    const newProvidersToday = await User.countDocuments({
      userType: 'provider',
      createdAt: { $gte: today }
    });
    const jobsCreatedToday = await Job.countDocuments({
      createdAt: { $gte: today }
    });
    const completedJobsToday = await Job.countDocuments({
      status: 'completed',
      completedAt: { $gte: today }
    });
    const todayTransactions = await Transaction.find({
      status: 'completed',
      completedAt: { $gte: today }
    });
    const pendingTransactions = await Transaction.countDocuments({ status: 'pending' });
    const totalJobs = await Job.countDocuments();

    const verifiedProviderIds = await CredentialVerification.distinct('userId', {
      status: 'approved'
    });
    const verifiedProviders = verifiedProviderIds.length;

    const pendingVerifications = await CredentialVerification.countDocuments({
      status: 'pending'
    });

    const completedJobs = await Job.find({
      status: 'completed',
      'rating.stars': { $exists: true, $ne: null }
    }).select('rating.stars');

    const totalRatings = completedJobs.reduce((sum, job) => {
      return sum + (job.rating?.stars || 0);
    }, 0);
    const averageRating = completedJobs.length > 0
      ? (totalRatings / completedJobs.length).toFixed(1)
      : '0.0';

    const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const pendingFees = pendingFeeRecords.reduce((sum, fee) => sum + (fee.amount || 0), 0);
    const pendingFeesCount = pendingFeeRecords.length;
    const revenueToday = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalUsers,
      customers,
      providers,
      activeJobs,
      totalJobs,
      totalRevenue,
      pendingFees,
      pendingFeesCount,
      onlineUsers,
      newUsersToday,
      newProvidersToday,
      jobsCreatedToday,
      completedJobsToday,
      revenueToday,
      pendingTransactions,
      verifiedProviders,
      pendingVerifications,
      averageRating,
      timestamp: new Date()
    };
  } catch (error) {
    // Silently handle session and connection errors
    if (error.name === 'MongoExpiredSessionError' ||
      error.name === 'MongoNotConnectedError' ||
      error.name === 'MongoServerError' ||
      error.message?.includes('session')) {
      return { timestamp: new Date() };
    }
    return { timestamp: new Date() };
  }
};

const broadcastAlertUpdates = async () => {
  try {
    const alerts = await getActiveAlerts();

    if (adminNamespace) {
      adminNamespace.to('admin').emit('alerts:update', {
        alerts,
        timestamp: new Date()
      });
    }
  } catch (error) {
    // Silently handle errors to avoid console spam
  }
};

const getActiveAlerts = async (adminId) => {
  try {
    const mongoose = require('mongoose');
    const DismissedAlert = require('../models/DismissedAlert');

    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    let alerts = await Alert.find({ isActive: true })
      .sort({ priority: -1, createdAt: -1 })
      .limit(10)
      .lean();

    if (alerts.length === 0) {
      const generatedAlerts = [];

      const pendingReports = await ReportedPost.find({ status: 'pending' })
        .populate('jobId', 'title')
        .populate('reportedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      for (const report of pendingReports) {
        generatedAlerts.push({
          _id: `report_${report._id}`,
          type: 'critical',
          category: 'reported_post',
          title: 'New Post Report',
          message: `Job "${report.jobId?.title || 'Unknown'}" reported for ${report.reason.replace(/_/g, ' ')}`,
          priority: 4,
          isActive: true,
          isRead: false,
          reportId: report._id,
          jobId: report.jobId?._id,
          createdAt: report.createdAt
        });
      }

      const pendingVerifications = await CredentialVerification.find({ status: 'pending' })
        .populate('userId', 'name email')
        .sort({ submittedAt: -1 })
        .limit(5)
        .lean();

      for (const verification of pendingVerifications) {
        generatedAlerts.push({
          _id: `verification_${verification._id}`,
          type: 'warning',
          category: 'verification_request',
          title: 'New Verification Request',
          message: `${verification.userId?.name || 'User'} submitted documents for verification`,
          priority: 3,
          isActive: true,
          isRead: false,
          verificationId: verification._id,
          userId: verification.userId?._id,
          createdAt: verification.submittedAt
        });
      }

      const openSupportTickets = await ChatSupport.find({ status: 'open' })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      for (const ticket of openSupportTickets) {
        const hasUnreadMessages = ticket.messages.some(msg =>
          msg.senderType === 'User' && !msg.isRead
        );

        if (hasUnreadMessages) {
          generatedAlerts.push({
            _id: `support_${ticket._id}`,
            type: 'info',
            category: 'support_ticket',
            title: 'New Support Message',
            message: `${ticket.userName} sent a message in ${ticket.subject}`,
            priority: 2,
            isActive: true,
            isRead: false,
            supportId: ticket._id,
            userId: ticket.userId,
            createdAt: ticket.lastMessage?.timestamp || ticket.createdAt
          });
        }
      }

      generatedAlerts.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      alerts = generatedAlerts.slice(0, 10);
    }

    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      const dismissedAlerts = await DismissedAlert.find({ adminId }).select('alertId');
      const dismissedAlertIds = dismissedAlerts.map(d => d.alertId.toString());

      alerts = alerts.filter(alert => !dismissedAlertIds.includes(alert._id.toString()));
    }

    return alerts;
  } catch (error) {
    if (error.name === 'MongoExpiredSessionError' ||
      error.name === 'MongoNotConnectedError' ||
      error.name === 'MongoServerError' ||
      error.message?.includes('session')) {
      return [];
    }
    return [];
  }
};

const emitAlertUpdate = (alert, updateType) => {
  if (adminNamespace) {
    adminNamespace.to('admin').emit('alert:updated', {
      alert,
      updateType,
      timestamp: new Date()
    });
  }
};

const emitChatSupportMessage = (chatSupportId, message) => {
  if (adminNamespace && chatSupportId && message) {
    adminNamespace.to(`support:${chatSupportId}`).emit('support:new_message', {
      chatSupportId,
      message
    });
  }
};

const emitChatSupportUpdate = (chatSupport, updates) => {
  if (adminNamespace && chatSupport) {
    const chatSupportId = chatSupport._id.toString();

    // Calculate displayStatus
    let displayStatus = 'open';
    const effectiveStatus = updates.status || chatSupport.status;
    const effectiveAcceptedBy = updates.acceptedBy !== undefined ? updates.acceptedBy : chatSupport.acceptedBy;

    if (effectiveStatus === 'closed') {
      displayStatus = 'resolved';
    } else if (effectiveStatus === 'open') {
      displayStatus = effectiveAcceptedBy ? 'pending' : 'open';
    }

    // Include displayStatus in updates
    const updatesWithDisplay = {
      ...updates,
      displayStatus
    };

    adminNamespace.to('admin').emit('support:chat_updated', {
      chatSupportId,
      updates: updatesWithDisplay,
      timestamp: new Date()
    });

    adminNamespace.to(`support:${chatSupportId}`).emit('support:chat_updated', {
      chatSupportId,
      updates: updatesWithDisplay,
      timestamp: new Date()
    });
  }
};

const emitNewChatSupport = (chatSupport) => {
  if (adminNamespace && chatSupport) {
    adminNamespace.to('admin').emit('support:new_chat', {
      chatSupport,
      timestamp: new Date()
    });
  }
};

const emitSupportUpdate = (ticket, updateType) => {
  if (adminNamespace) {
    adminNamespace.to('admin').emit('support:ticket_updated', {
      ticket,
      updateType,
      timestamp: new Date()
    });

    if (updateType === 'new_ticket') {
      adminNamespace.to('admin').emit('support:new_ticket', {
        ticket,
        timestamp: new Date()
      });
    }

    if (ticket.ticketId || ticket._id) {
      const ticketId = ticket.ticketId || ticket._id;
      adminNamespace.to(`support:${ticketId}`).emit('support:ticket_updated', {
        ticketId,
        ...ticket,
        updateType,
        timestamp: new Date()
      });
    }
  }
};

const setupChatSupportChangeStream = () => {
  if (chatSupportChangeStream) {
    return;
  }

  try {
    const changeStream = ChatSupport.watch([], {
      fullDocument: 'updateLookup'
    });

    changeStream.on('change', async (change) => {
      try {
        if ((change.operationType === 'update' || change.operationType === 'insert')) {
          const chatSupportId = change.documentKey._id.toString();

          if (change.operationType === 'insert') {
            const chatSupport = change.fullDocument;
            if (chatSupport && adminNamespace) {
              adminNamespace.to('admin').emit('support:new_chat', {
                chatSupport,
                timestamp: new Date()
              });
            }
            return;
          }

          const chatSupport = change.fullDocument || await ChatSupport.findById(chatSupportId);

          if (chatSupport) {
            const hasNewMessage = change.updateDescription?.updatedFields?.messages ||
              change.updateDescription?.updatedFields?.['messages.0'] ||
              Object.keys(change.updateDescription?.updatedFields || {}).some(key => key.startsWith('messages.'));

            if (hasNewMessage && chatSupport.messages.length > 0) {
              // Determine which messages are newly added.
              // When multiple messages are pushed in a single save() (e.g. ticket creation
              // with 2 image attachments), MongoDB reports each as a separate updatedField
              // key like "messages.N", "messages.N+1", etc. We must emit ALL of them —
              // not just the last one — so the admin panel shows every new message.
              const updatedFields = change.updateDescription?.updatedFields || {};
              const individualKeys = Object.keys(updatedFields).filter(k => /^messages\.\d+$/.test(k));

              let msgsToEmit = [];
              if (individualKeys.length > 0) {
                // Specific indices were set — collect them in ascending order
                const indices = individualKeys
                  .map(k => parseInt(k.split('.')[1], 10))
                  .sort((a, b) => a - b);
                msgsToEmit = indices.map(i => chatSupport.messages[i]).filter(Boolean);
              } else {
                // Whole array replaced (e.g. insert) — just emit the last message
                msgsToEmit = [chatSupport.messages[chatSupport.messages.length - 1]];
              }

              if (adminNamespace) {
                for (const msg of msgsToEmit) {
                  const messageData = {
                    chatSupportId,
                    message: {
                      _id: msg._id.toString(),
                      senderId: msg.senderId.toString(),
                      senderName: msg.senderName,
                      senderType: msg.senderType,
                      message: msg.message,
                      imageUrl: msg.imageUrl || null,
                      timestamp: msg.timestamp.toISOString()
                    }
                  };
                  adminNamespace.to(`support:${chatSupportId}`).emit('support:new_message', messageData);
                  adminNamespace.to('admin').emit('support:new_message', messageData);
                }
              }
              // Note: Mobile clients receive notifications via their own socket connection
            }

            if (change.updateDescription?.updatedFields?.status) {
              const updates = { status: chatSupport.status };
              if (chatSupport.closedAt) {
                updates.closedAt = chatSupport.closedAt;
              }

              // Calculate displayStatus
              let displayStatus = 'open';
              if (chatSupport.status === 'closed') {
                displayStatus = 'resolved';
              } else if (chatSupport.status === 'open') {
                displayStatus = chatSupport.acceptedBy ? 'pending' : 'open';
              }
              updates.displayStatus = displayStatus;

              if (adminNamespace) {
                adminNamespace.to('admin').emit('support:chat_updated', {
                  chatSupportId,
                  updates,
                  timestamp: new Date()
                });

                adminNamespace.to(`support:${chatSupportId}`).emit('support:chat_updated', {
                  chatSupportId,
                  updates,
                  timestamp: new Date()
                });
              }

              if (global.io) {
                global.io.to(`support:${chatSupportId}`).emit('support:chat_updated', {
                  chatSupportId,
                  updates,
                  timestamp: new Date()
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing chat support change:', error);
      }
    });

    changeStream.on('error', (error) => {
      if (error.codeName === 'Location40573') {
        console.warn('⚠️  MongoDB change streams require replica set. Falling back to direct socket emits.');
        console.log('💡 To enable change streams, configure MongoDB as a replica set: https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/');
      } else {
        console.error('Chat support change stream error:', error);
      }
    });

    chatSupportChangeStream = changeStream;
  } catch (error) {
    if (error.codeName === 'Location40573') {
      console.warn('⚠️  MongoDB change streams require replica set. Chat will work without real-time updates.');
      console.log('💡 To enable change streams, configure MongoDB as a replica set: https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/');
    } else {
      console.error('Failed to setup chat support change stream:', error);
    }
  }
};

const closeChatSupportChangeStream = () => {
  if (chatSupportChangeStream) {
    try {
      chatSupportChangeStream.close();
      chatSupportChangeStream = null;
    } catch (error) {
      console.error('Error closing chat support change stream:', error);
    }
  }

  activeIntervals.forEach((intervals, socketId) => {
    Object.values(intervals).forEach(interval => clearInterval(interval));
  });
  activeIntervals.clear();
};

module.exports = {
  setupSocketHandlers,
  emitAlertUpdate,
  emitSupportUpdate,
  emitChatSupportUpdate,
  emitNewChatSupport,
  emitChatSupportMessage,
  closeChatSupportChangeStream
};
