const User = require('../models/User');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityFeed = require('../models/ActivityFeed');
const Alert = require('../models/Alert');
const ChatSupport = require('../models/ChatSupport');
const ReportedPost = require('../models/ReportedPost');
const CredentialVerification = require('../models/CredentialVerification');

let adminNamespace = null;
let mainIo = null;
let chatSupportChangeStream = null;
let activeIntervals = new Map();

const setupSocketHandlers = (io) => {
  mainIo = io;
  adminNamespace = io.of('/admin');
  
  setupChatSupportChangeStream();
  setupMainNamespaceHandlers(io);
  
  adminNamespace.on('connection', async (socket) => {
    console.log('🔌 Admin connected:', socket.id);
    
    socket.join('admin');
    socket.emit('connection:status', 'connected');
    
    await sendInitialData(socket);
    const intervals = setupRealtimeIntervals(socket);
    
    socket.on('request:dashboard', () => broadcastDashboardStats());
    socket.on('request:alerts', () => broadcastAlertUpdates());
    
    socket.on('support:join_chat', (data) => {
      if (data.chatSupportId) {
        socket.join(`support:${data.chatSupportId}`);
        console.log(`💬 Admin joined chat support: ${data.chatSupportId}`);
        socket.emit('support:joined_chat', { chatSupportId: data.chatSupportId });
      }
    });
    
    socket.on('support:leave_chat', (data) => {
      if (data.chatSupportId) {
        socket.leave(`support:${data.chatSupportId}`);
        console.log(`💬 Admin left chat support: ${data.chatSupportId}`);
      }
    });
    
    socket.on('support:send_message', async (data) => {
      console.log('📥 Admin send_message received:', data);
      
      if (data.chatSupportId && data.message) {
        try {
          const chatSupport = await ChatSupport.findById(data.chatSupportId);
          
          if (!chatSupport) {
            console.error('❌ Chat support not found:', data.chatSupportId);
            socket.emit('support:message_error', { 
              error: 'Chat support not found',
              chatSupportId: data.chatSupportId 
            });
            return;
          }
          
          if (chatSupport.status !== 'open') {
            console.error('❌ Chat support is closed:', data.chatSupportId);
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
          
          console.log(`✅ Admin message saved to DB:`, newMessage._id);
        } catch (error) {
          console.error('❌ Error sending admin chat support message:', error);
          socket.emit('support:message_error', { 
            error: 'Failed to send message',
            chatSupportId: data.chatSupportId 
          });
        }
      } else {
        console.error('❌ Missing chatSupportId or message:', data);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Admin disconnected:', socket.id);
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
  io.on('connection', (socket) => {
    console.log('📱 User connected to main namespace:', socket.id);
    
    socket.on('authenticate', (data) => {
      console.log('📱 User attempting authentication:', data?.userId);
      socket.emit('authenticated');
      console.log('✅ User authenticated:', socket.id);
    });
    
    socket.on('support:join_chat', (data) => {
      if (data.chatSupportId) {
        socket.join(`support:${data.chatSupportId}`);
        console.log(`📱 User joined chat support: ${data.chatSupportId}`);
        socket.emit('support:joined_chat', { chatSupportId: data.chatSupportId });
      }
    });
    
    socket.on('support:leave_chat', (data) => {
      if (data.chatSupportId) {
        socket.leave(`support:${data.chatSupportId}`);
        console.log(`📱 User left chat support: ${data.chatSupportId}`);
      }
    });
    
    socket.on('support:send_message', async (data) => {
      console.log('📥 Mobile send_message received:', JSON.stringify(data, null, 2));
      
      if (!data.chatSupportId) {
        console.error('❌ Missing chatSupportId');
        socket.emit('support:message_error', { error: 'Missing chatSupportId' });
        return;
      }
      
      if (!data.message) {
        console.error('❌ Missing message');
        socket.emit('support:message_error', { error: 'Missing message', chatSupportId: data.chatSupportId });
        return;
      }
      
      try {
        const chatSupport = await ChatSupport.findById(data.chatSupportId);
        
        if (!chatSupport) {
          console.error('❌ Chat support not found:', data.chatSupportId);
          socket.emit('support:message_error', { 
            error: 'Chat support not found',
            chatSupportId: data.chatSupportId 
          });
          return;
        }
        
        if (chatSupport.status !== 'open') {
          console.error('❌ Chat support is closed:', data.chatSupportId);
          socket.emit('support:message_error', { 
            error: 'Chat support is closed',
            chatSupportId: data.chatSupportId 
          });
          return;
        }
        
        const mongoose = require('mongoose');
        const userId = data.userId || socket.handshake.auth?.userId || '000000000000000000000000';
        console.log('👤 Using userId:', userId);
        
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
        
        console.log('💾 Saving message:', newMessage);
        chatSupport.messages.push(newMessage);
        await chatSupport.save();
        
        const savedMessage = chatSupport.messages[chatSupport.messages.length - 1];
        console.log(`✅ Mobile message saved to DB with ID:`, savedMessage._id);
        
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
        
        console.log('📤 Sending immediate confirmation to sender');
        socket.emit('support:new_message', messageData);
        
        console.log('📡 Broadcasting to all users in room');
        io.to(`support:${chatSupportId}`).emit('support:new_message', messageData);
        
      } catch (error) {
        console.error('❌ Error sending mobile chat support message:', error);
        socket.emit('support:message_error', { 
          error: 'Failed to send message: ' + error.message,
          chatSupportId: data.chatSupportId 
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('📱 User disconnected from main namespace:', socket.id);
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
    console.error('❌ Error sending initial data:', error);
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
    adminNamespace.to('admin').emit('stats:update', stats);
  } catch (error) {
    console.error('❌ Error broadcasting dashboard stats:', error);
  }
};

const getRealtimeStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalUsers = await User.countDocuments();
    const activeJobs = await Job.countDocuments({ status: { $in: ['open', 'in_progress'] } });
    const onlineUsers = await User.countDocuments({ isOnline: true });
    const completedTransactions = await Transaction.find({ status: 'completed' });
    const usersWithFees = await User.find({ 'fees.isPaid': false });
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
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
    const pendingFees = usersWithFees.reduce((sum, user) => {
      return sum + user.fees.filter(fee => !fee.isPaid).reduce((feeSum, fee) => feeSum + fee.amount, 0);
    }, 0);
    const revenueToday = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalUsers,
      activeJobs,
      totalJobs,
      totalRevenue,
      pendingFees,
      onlineUsers,
      newUsersToday,
      completedJobsToday,
      revenueToday,
      pendingTransactions,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error getting realtime stats:', error);
    return { timestamp: new Date() };
  }
};

const broadcastAlertUpdates = async () => {
  try {
    const alerts = await getActiveAlerts();
    
    adminNamespace.to('admin').emit('alerts:update', {
      alerts,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Error broadcasting alert updates:', error);
  }
};

const getActiveAlerts = async () => {
  try {
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
    console.error('Error getting active alerts:', error);
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
    console.log(`🔔 Alert update emitted: ${updateType}`);
  }
};

const emitChatSupportMessage = (chatSupportId, message) => {
  if (adminNamespace && chatSupportId && message) {
    console.log('📤 Broadcasting message to admins:', { chatSupportId, message });
    
    adminNamespace.to(`support:${chatSupportId}`).emit('support:new_message', {
      chatSupportId,
      message
    });
    
    console.log('💬 Broadcasted message to admin panel for chat:', chatSupportId);
  }
};

const emitChatSupportUpdate = (chatSupport, updates) => {
  if (adminNamespace && chatSupport) {
    const chatSupportId = chatSupport._id.toString();
    
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
    
    console.log(`💬 Chat support update emitted: ${chatSupportId}`);
  }
};

const emitNewChatSupport = (chatSupport) => {
  if (adminNamespace && chatSupport) {
    adminNamespace.to('admin').emit('support:new_chat', {
      chatSupport,
      timestamp: new Date()
    });
    
    console.log(`💬 New chat support emitted: ${chatSupport._id}`);
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
    
    console.log(`🎫 Support ticket update emitted: ${updateType}`);
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
              console.log('📡 New chat support created:', chatSupportId);
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

              console.log('📡 Broadcasting message from DB change stream to both namespaces');
              
              if (adminNamespace) {
                adminNamespace.to(`support:${chatSupportId}`).emit('support:new_message', messageData);
                adminNamespace.to('admin').emit('support:new_message', messageData);
                console.log('✅ Broadcasted to admin namespace');
              }
              
              if (mainIo) {
                mainIo.to(`support:${chatSupportId}`).emit('support:new_message', messageData);
                console.log('✅ Broadcasted to main namespace (mobile users)');
              }
            }
            
            if (change.updateDescription?.updatedFields?.status) {
              const updates = { status: chatSupport.status };
              if (chatSupport.closedAt) {
                updates.closedAt = chatSupport.closedAt;
              }
              
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
              
              console.log('📡 Chat support status updated:', chatSupportId, updates.status);
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
    console.log('👁️ Chat support change stream initialized');
  } catch (error) {
    console.error('Failed to setup chat support change stream:', error);
  }
};

const closeChatSupportChangeStream = () => {
  if (chatSupportChangeStream) {
    try {
      chatSupportChangeStream.close();
      chatSupportChangeStream = null;
      console.log('Chat support change stream closed');
    } catch (error) {
      console.error('Error closing chat support change stream:', error);
    }
  }
  
  activeIntervals.forEach((intervals, socketId) => {
    Object.values(intervals).forEach(interval => clearInterval(interval));
  });
  activeIntervals.clear();
  console.log('All active intervals cleared');
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
