const User = require('../models/User');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityFeed = require('../models/ActivityFeed');
const Alert = require('../models/Alert');

let adminNamespace = null;

const setupSocketHandlers = (io) => {
  adminNamespace = io.of('/admin');
  
  adminNamespace.on('connection', async (socket) => {
    console.log('🔌 Admin connected:', socket.id);
    
    socket.join('admin');
    socket.emit('connection:status', 'connected');
    
    await sendInitialData(socket);
    const intervals = setupRealtimeIntervals(socket);
    
    socket.on('request:dashboard', () => broadcastDashboardStats());
    socket.on('request:alerts', () => broadcastAlertUpdates());
    
    socket.on('disconnect', () => {
      console.log('🔌 Admin disconnected:', socket.id);
      Object.values(intervals).forEach(interval => clearInterval(interval));
    });
  });
  
  return adminNamespace;
};

const sendInitialData = async (socket) => {
  try {
    console.log('📡 Sending initial data to admin...');
    
    const stats = await getRealtimeStats();
    socket.emit('stats:initial', stats);
    
    const alerts = await getActiveAlerts();
    socket.emit('alerts:initial', alerts);
    
    console.log('✅ Initial data sent successfully');
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
  
  return intervals;
};

const broadcastDashboardStats = async () => {
  try {
    const stats = await getRealtimeStats();
    adminNamespace.to('admin').emit('stats:update', stats);
    console.log('📊 Dashboard stats broadcasted');
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
    
    console.log('🚨 Alert updates broadcasted');
  } catch (error) {
    console.error('❌ Error broadcasting alert updates:', error);
  }
};

const getActiveAlerts = async () => {
  try {
    return await Alert.find({ isActive: true })
      .sort({ priority: -1, createdAt: -1 })
      .limit(10);
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

const emitSupportUpdate = (ticket, updateType) => {
  if (adminNamespace) {
    adminNamespace.to('admin').emit('support:ticket_updated', {
      ticket,
      updateType,
      timestamp: new Date()
    });
    console.log(`🎫 Support ticket update emitted: ${updateType}`);
  }
};

module.exports = {
  setupSocketHandlers,
  emitAlertUpdate,
  emitSupportUpdate
};
