const User = require('../models/User');
const Wallet = require('../models/Wallet');
const FeeRecord = require('../models/FeeRecord');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityFeed = require('../models/ActivityFeed');
const Alert = require('../models/Alert');

const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('Fetching dashboard stats...'); // Debug log

    // Get basic stats
    const totalUsers = await User.countDocuments();
    const activeJobs = await Job.countDocuments({ status: { $in: ['open', 'in_progress'] } });
    const onlineUsers = await User.countDocuments({ isOnline: true });
    
    console.log(`Found ${totalUsers} users, ${activeJobs} active jobs, ${onlineUsers} online`); // Debug log
    
    // Get revenue stats from transactions
    const completedTransactions = await Transaction.find({ status: 'completed' });
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    console.log(`Found ${completedTransactions.length} completed transactions, total revenue: ${totalRevenue}`); // Debug log
    
    // Get pending fees from FeeRecord collection
    const pendingFeeRecords = await FeeRecord.find({ 
      status: { $in: ['pending', 'overdue'] } 
    });
    const pendingFees = pendingFeeRecords.reduce((sum, fee) => sum + (fee.amount || 0), 0);

    console.log(`Found ${pendingFeeRecords.length} pending fee records, total pending: ${pendingFees}`); // Debug log

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
    const revenueToday = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    console.log(`Today's stats: ${newUsersToday} new users, ${completedJobsToday} completed jobs, ${revenueToday} revenue`); // Debug log

    const stats = {
      totalUsers,
      activeJobs,
      totalRevenue,
      pendingFees,
      onlineUsers,
      newUsersToday,
      completedJobsToday,
      revenueToday
    };

    console.log('Final stats:', stats); // Debug log

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

const getActivity = async (req, res) => {
  try {
    const activities = await ActivityFeed.find()
      .populate('userId', 'name email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
};

const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ isRead: false })
      .populate('userId', 'name email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

const markAlertAsRead = async (req, res) => {
  try {
    const { alertId } = req.params;
    
    await Alert.findByIdAndUpdate(alertId, { isRead: true });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
};

module.exports = { getStats, getActivity, getAlerts, markAlertAsRead };