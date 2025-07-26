const User = require('../models/User');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityFeed = require('../models/ActivityFeed');

const setupSocketHandlers = (io) => {
  // Admin namespace for secure admin-only communications
  const adminNamespace = io.of('/admin');
  
  adminNamespace.on('connection', (socket) => {
    console.log('🔌 Admin connected:', socket.id);
    
    // Join admin room for broadcasting
    socket.join('admin');
    
    // Send connection confirmation
    socket.emit('connection:status', 'connected');
    
    // Broadcast real-time stats every 5 seconds
    const statsInterval = setInterval(async () => {
      try {
        const stats = await getRealtimeStats();
        adminNamespace.to('admin').emit('stats:update', stats);
      } catch (error) {
        console.error('Error broadcasting stats:', error);
      }
    }, 5000);
    
    // Broadcast activity feed updates every 10 seconds
    const activityInterval = setInterval(async () => {
      try {
        const recentActivity = await ActivityFeed.find()
          .populate('userId', 'name email')
          .populate('jobId', 'title')
          .sort({ createdAt: -1 })
          .limit(10);
        
        adminNamespace.to('admin').emit('activity:update', recentActivity);
      } catch (error) {
        console.error('Error broadcasting activity:', error);
      }
    }, 10000);
    
    socket.on('disconnect', () => {
      console.log('🔌 Admin disconnected:', socket.id);
      clearInterval(statsInterval);
      clearInterval(activityInterval);
    });
  });
  
  return adminNamespace;
};

const getRealtimeStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get basic stats
    const totalUsers = await User.countDocuments();
    const activeJobs = await Job.countDocuments({ status: { $in: ['open', 'in_progress'] } });
    const onlineUsers = await User.countDocuments({ isOnline: true });
    
    // Get revenue stats
    const completedTransactions = await Transaction.find({ status: 'completed' });
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Get pending fees
    const usersWithFees = await User.find({ 'fees.isPaid': false });
    const pendingFees = usersWithFees.reduce((sum, user) => {
      return sum + user.fees.filter(fee => !fee.isPaid).reduce((feeSum, fee) => feeSum + fee.amount, 0);
    }, 0);

    // Get today's stats
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
    const completedJobsToday = await Job.countDocuments({ 
      status: 'completed', 
      completedAt: { $gte: today } 
    });
    const todayTransactions = await Transaction.find({ 
      status: 'completed',
      completedAt: { $gte: today }
    });
    const revenueToday = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalUsers,
      activeJobs,
      totalRevenue,
      pendingFees,
      onlineUsers,
      newUsersToday,
      completedJobsToday,
      revenueToday
    };
  } catch (error) {
    console.error('Error getting realtime stats:', error);
    return {};
  }
};

module.exports = { setupSocketHandlers };