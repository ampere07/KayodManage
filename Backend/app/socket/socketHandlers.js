const User = require('../models/User');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityFeed = require('../models/ActivityFeed');
const Alert = require('../models/Alert');
const ChatSupport = require('../models/ChatSupport');
const ReportedPost = require('../models/ReportedPost');
const CredentialVerification = require('../models/CredentialVerification');
const FeeRecord = require('../models/FeeRecord');

let adminNamespace = null;
let mainIo = null;
let chatSupportChangeStream = null;
let activeIntervals = new Map();

const setupSocketHandlers = (io) => {
  mainIo = io;
  adminNamespace = io.of('/admin');
  
  setupChatSupportChangeStream();
  setupMainNamespaceHandlers(io);
  
  // Track connected admins to avoid duplicate logs
  const connectedAdmins = new Set();
  
  adminNamespace.on('connection', async (socket) => {
    // Only log new unique connections
    if (!connectedAdmins.has(socket.id)) {
      console.log('🔌 Admin connected:', socket.id);
      connectedAdmins.add(socket.id);
    }
    
    socket.join('admin');
    socket.emit('connection:status', 'connected');
    
    await sendInitialData(socket);
    const intervals = setupRealtimeIntervals(socket);
    
    socket.on('request:dashboard', () => broadcastDashboardStats());
    socket.on('request:alerts', () => broadcastAlertUpdates());
    
    socket.on('support:join_chat', (data) => {
      if (data.chatSupportId) {
        socket.join(`support:${data.chatSupportId}`);
        socket.emit('support:joined_chat', { chatSupportId: data.chatSupportId });
      }
    });
    
    socket.on('support:leave_chat', (data) => {
      if (data.chatSupportId) {
        socket.leave(`support:${data.chatSupportId}`);
      }
    });
    
    socket.on('support:send_message', async (data) => {
      if (data.chatSupportId && data.message) {
        try {
          const chatSupport = await ChatSupport.findById(data.chatSupportId);
          
          if (!chatSupport) {
            socket.emit('support:message_error', { 
              error: 'Chat support not found',
              chatSupportId: data.chatSupportId 
            });
            return;
          }
          
          if (chatSupport.status !== 'open') {
            socket.emit('support:message_error', { 
              error: 'Chat support is closed',
              chatSupportId: data.chatSupportId 
            });
            return;
          }
          
          const mongoose = require('mongoose');
          const adminId = '000000000000000000000000';
          const adminObjectId = new mongoose.Types.ObjectId(adminId);
          
          const newMessage = {
            senderId: data.senderId || adminObjectId,
            senderName: data.senderName || 'Support Agent',
            senderType: data.senderType || 'Admin',
            message: data.message.trim(),
            timestamp: new Date()
          };
          
          chatSupport.messages.push(newMessage);
          await chatSupport.save();
        } catch (error) {
          console.error('❌ Error sending admin message:', error.message);
          socket.emit('support:message_error', { 
            error: 'Failed to send message',
            chatSupportId: data.chatSupportId 
          });
        }
      }
    });
    
    socket.on('disconnect', () => {
      connectedAdmins.delete(socket.id);
      const intervals = activeIntervals.get(socket.id);
      if (intervals) {
        Object.values(intervals).forEach(interval => clearInterval(interval));
        activeIntervals.delete(socket.id);
      }
    });
  });
  
  return adminNamespace;
};

const setupMainNamespaceHandlers = (io) => {
  const connectedUsers = new Set();
  
  io.on('connection', (socket) => {
    // Only log new unique connections
    if (!connectedUsers.has(socket.id)) {
      console.log('📱 User connected:', socket.id);
      connectedUsers.add(socket.id);
    }
    
    socket.on('authenticate', (data) => {
      socket.emit('authenticated');
    });
    
    socket.on('support:join_chat', (data) => {
      if (data.chatSupportId) {
        socket.join(`support:${data.chatSupportId}`);
        socket.emit('support:joined_chat', { chatSupportId: data.chatSupportId });
      }
    });
    
    socket.on('support:leave_chat', (data) => {
      if (data.chatSupportId) {
        socket.leave(`support:${data.chatSupportId}`);
      }
    });
    
    socket.on('support:send_message', async (data) => {
      if (!data.chatSupportId) {
        socket.emit('support:message_error', { error: 'Missing chatSupportId' });
        return;
      }
      
      if (!data.message) {
        socket.emit('support:message_error', { error: 'Missing message', chatSupportId: data.chatSupportId });
        return;
      }
      
      try {
        const chatSupport = await ChatSupport.findById(data.chatSupportId);
        
        if (!chatSupport) {
          socket.emit('support:message_error', { 
            error: 'Chat support not found',
            chatSupportId: data.chatSupportId 
          });
          return;
        }
        
        if (chatSupport.status !== 'open') {
          socket.emit('support:message_error', { 
            error: 'Chat support is closed',
            chatSupportId: data.chatSupportId 
          });
          return;
        }
        
        const mongoose = require('mongoose');
        const userId = data.userId || socket.handshake.auth?.userId || '000000000000000000000000';
        
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
          ? new mongoose.Types.ObjectId(userId)
          : new mongoose.Types.ObjectId('000000000000000000000000');
        
        const newMessage = {
          senderId: userObjectId,
          senderName: data.senderName || 'User',
          senderType: 'User',
          message: data.message.trim(),
          timestamp: new Date()
        };
        
        chatSupport.messages.push(newMessage);
        await chatSupport.save();
        
        const savedMessage = chatSupport.messages[chatSupport.messages.length - 1];
        
        // Immediately send confirmation back to sender
        const messageData = {
          chatSupportId,
          message: {
            _id: savedMessage._id.toString(),
            senderId: savedMessage.senderId.toString(),
            senderName: savedMessage.senderName,
            senderType: savedMessage.senderType,
            message: savedMessage.message,
            timestamp: savedMessage.timestamp.toISOString()
          }
        };
        
        socket.emit('support:new_message', messageData);
        io.to(`support:${chatSupportId}`).emit('support:new_message', messageData);
        
      } catch (error) {
        console.error('❌ Error sending message:', error.message);
        socket.emit('support:message_error', { 
          error: 'Failed to send message: ' + error.message,
          chatSupportId: data.chatSupportId 
        });
      }
    });
    
    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
    });
  });
};

const sendInitialData = async (socket) => {
  try {
    const stats = await getRealtimeStats();
    socket.emit('stats:initial', stats);
    
    const alerts = await getActiveAlerts();
    socket.emit('alerts:initial', alerts);
  } catch (error) {
    // Silently handle errors
  }
};

const setupRealtimeIntervals = (socket) => {
  const intervals = {};
  
  intervals.stats = setInterval(async () => {
    await broadcastDashboardStats();
  }, 5000);
  
  intervals.alerts = setInterval(async () => {
    await broadcastAlertUpdates();
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

const getActiveAlerts = async () => {
  try {
    const mongoose = require('mongoose');
    
    // Check if database is connected before querying
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
          createdAt: verification.submittedAt
        });
      }

      generatedAlerts.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      alerts = generatedAlerts.slice(0, 10);
    }

    return alerts;
  } catch (error) {
    // Silently handle session and connection errors
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
              const lastMessage = chatSupport.messages[chatSupport.messages.length - 1];
              
              const messageData = {
                chatSupportId,
                message: {
                  _id: lastMessage._id.toString(),
                  senderId: lastMessage.senderId.toString(),
                  senderName: lastMessage.senderName,
                  senderType: lastMessage.senderType,
                  message: lastMessage.message,
                  timestamp: lastMessage.timestamp.toISOString()
                }
              };
              
              if (adminNamespace) {
                adminNamespace.to(`support:${chatSupportId}`).emit('support:new_message', messageData);
                adminNamespace.to('admin').emit('support:new_message', messageData);
              }
              
              if (mainIo) {
                mainIo.to(`support:${chatSupportId}`).emit('support:new_message', messageData);
              }
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
              
              if (mainIo) {
                mainIo.to(`support:${chatSupportId}`).emit('support:chat_updated', {
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
      console.error('Chat support change stream error:', error);
    });

    chatSupportChangeStream = changeStream;
  } catch (error) {
    console.error('Failed to setup chat support change stream:', error);
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
