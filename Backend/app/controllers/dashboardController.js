const User = require('../models/User');
const Wallet = require('../models/Wallet');
const FeeRecord = require('../models/FeeRecord');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityFeed = require('../models/ActivityFeed');
const Alert = require('../models/Alert');
const DismissedAlert = require('../models/DismissedAlert');
const ReportedPost = require('../models/ReportedPost');
const CredentialVerification = require('../models/CredentialVerification');
const ChatSupport = require('../models/ChatSupport');

const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalUsers = await User.countDocuments();
    const customers = await User.countDocuments({ userType: 'client' });
    const providers = await User.countDocuments({ userType: 'provider' });
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ status: { $in: ['open', 'in_progress'] } });
    const onlineUsers = await User.countDocuments({ isOnline: true });
    
    const completedTransactions = await Transaction.find({ status: 'completed' });
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const pendingFeeRecords = await FeeRecord.find({ 
      status: { $in: ['pending', 'overdue'] } 
    });
    const pendingFees = pendingFeeRecords.reduce((sum, fee) => sum + (fee.amount || 0), 0);
    const pendingFeesCount = pendingFeeRecords.length;

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
    const revenueToday = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

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

    const stats = {
      totalUsers,
      customers,
      providers,
      totalJobs,
      activeJobs,
      totalRevenue,
      pendingFees,
      pendingFeesCount,
      onlineUsers,
      newUsersToday,
      newProvidersToday,
      jobsCreatedToday,
      completedJobsToday,
      revenueToday,
      verifiedProviders,
      pendingVerifications,
      averageRating
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

const getActivity = async (req, res) => {
  try {
    let activities = await ActivityFeed.find()
      .populate('userId', 'name email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    activities = activities.map(activity => ({
      ...activity,
      timestamp: activity.createdAt
    }));

    if (activities.length === 0) {
      activities = await generateActivitiesFromData();
    }

    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
};

const generateActivitiesFromData = async () => {
  try {
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id name email createdAt');

    const recentJobs = await Job.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id title client provider createdAt status');

    const recentTransactions = await Transaction.find({ status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(10)
      .select('_id amount from to completedAt');

    const generatedActivities = [];

    for (const user of recentUsers) {
      generatedActivities.push({
        _id: `user_${user._id}`,
        type: 'user_registered',
        description: `${user.name} registered on the platform`,
        timestamp: user.createdAt,
        userId: {
          _id: user._id,
          name: user.name,
          email: user.email
        },
        metadata: { generatedFromData: true }
      });
    }

    for (const job of recentJobs) {
      const clientUser = job.client ? await User.findById(job.client).select('name email') : null;
      
      generatedActivities.push({
        _id: `job_${job._id}`,
        type: job.status === 'completed' ? 'job_completed' : 'job_posted',
        description: job.status === 'completed' 
          ? `Job "${job.title}" was completed`
          : `New job posted: "${job.title}"`,
        timestamp: job.createdAt,
        userId: clientUser ? {
          _id: clientUser._id,
          name: clientUser.name,
          email: clientUser.email
        } : null,
        jobId: {
          _id: job._id,
          title: job.title
        },
        metadata: { generatedFromData: true }
      });
    }

    for (const transaction of recentTransactions) {
      const fromUser = transaction.from ? await User.findById(transaction.from).select('name email') : null;
      
      if (fromUser) {
        generatedActivities.push({
          _id: `transaction_${transaction._id}`,
          type: 'payment_completed',
          description: `Payment of ₱${transaction.amount.toLocaleString()} completed`,
          timestamp: transaction.completedAt || transaction.createdAt,
          userId: {
            _id: fromUser._id,
            name: fromUser.name,
            email: fromUser.email
          },
          transactionId: transaction._id,
          metadata: { generatedFromData: true }
        });
      }
    }

    generatedActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return generatedActivities.slice(0, 50);
  } catch (error) {
    console.error('Error generating activities from data:', error);
    return [];
  }
};

const getAlerts = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const adminId = req.admin?.id || req.user?.id;
    
    let alerts = await Alert.find({ isActive: true })
      .populate('userId', 'name email')
      .populate('jobId', 'title')
      .populate('reportId')
      .populate('verificationId')
      .populate('supportId')
      .sort({ priority: -1, createdAt: -1 })
      .limit(20);

    if (alerts.length === 0) {
      const generatedAlerts = await generateAlertsFromData();
      alerts = generatedAlerts;
    }

    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      const dismissedAlerts = await DismissedAlert.find({ adminId }).select('alertId');
      const dismissedAlertIds = dismissedAlerts.map(d => d.alertId.toString());
      
      alerts = alerts.filter(alert => !dismissedAlertIds.includes(alert._id.toString()));
    }

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

const generateAlertsFromData = async () => {
  try {
    const generatedAlerts = [];

    const pendingReports = await ReportedPost.find({ status: 'pending' })
      .populate('jobId', 'title')
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

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
        userId: report.reportedBy,
        actionUrl: `/reports/${report._id}`,
        createdAt: report.createdAt,
        metadata: { generatedFromData: true }
      });
    }

    const pendingVerifications = await CredentialVerification.find({ status: 'pending' })
      .populate('userId', 'name email')
      .sort({ submittedAt: -1 })
      .limit(10);

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
        actionUrl: `/verifications/${verification._id}`,
        createdAt: verification.submittedAt,
        metadata: { generatedFromData: true }
      });
    }

    const openSupportTickets = await ChatSupport.find({ status: 'open' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

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
          actionUrl: `/support/${ticket._id}`,
          createdAt: ticket.lastMessage?.timestamp || ticket.createdAt,
          metadata: { generatedFromData: true }
        });
      }
    }

    generatedAlerts.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return generatedAlerts.slice(0, 20);
  } catch (error) {
    console.error('Error generating alerts from data:', error);
    return [];
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

const getRevenueChart = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const chartData = [];

    if (days <= 31) {
      for (let i = days - 1; i >= 0; i--) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - i);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);

        const dayTransactions = await Transaction.find({
          status: 'completed',
          $or: [
            { completedAt: { $gte: startDate, $lte: endDate } },
            { 
              completedAt: null,
              createdAt: { $gte: startDate, $lte: endDate }
            }
          ]
        });

        const revenue = dayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        chartData.push({
          name: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: revenue,
          transactions: dayTransactions.length
        });
      }
    } else {
      const weeksToShow = Math.ceil(days / 7);
      for (let i = weeksToShow - 1; i >= 0; i--) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - (i * 7));
        endDate.setHours(23, 59, 59, 999);

        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);

        const weekTransactions = await Transaction.find({
          status: 'completed',
          $or: [
            { completedAt: { $gte: startDate, $lte: endDate } },
            { 
              completedAt: null,
              createdAt: { $gte: startDate, $lte: endDate }
            }
          ]
        });

        const revenue = weekTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        const weekLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        chartData.push({
          name: weekLabel,
          revenue: revenue,
          transactions: weekTransactions.length
        });
      }
    }

    res.json(chartData);
  } catch (error) {
    console.error('Error fetching revenue chart data:', error);
    res.status(500).json({ error: 'Failed to fetch revenue chart data' });
  }
};

const getStatsComparison = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const totalUsersNow = await User.countDocuments();
    const totalUsersLastMonth = await User.countDocuments({ 
      createdAt: { $lte: lastMonthEnd } 
    });

    const totalJobsNow = await Job.countDocuments();
    const totalJobsLastMonth = await Job.countDocuments({ 
      createdAt: { $lte: lastMonthEnd } 
    });

    const currentMonthRevenueDocs = await Transaction.find({
      status: 'completed',
      $or: [
        { completedAt: { $gte: currentMonthStart } },
        { completedAt: null, createdAt: { $gte: currentMonthStart } }
      ]
    });
    const currentMonthRevenue = currentMonthRevenueDocs.reduce((sum, t) => sum + (t.amount || 0), 0);

    const lastMonthRevenueDocs = await Transaction.find({
      status: 'completed',
      $or: [
        { completedAt: { $gte: lastMonthStart, $lte: lastMonthEnd } },
        { completedAt: null, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }
      ]
    });
    const lastMonthRevenue = lastMonthRevenueDocs.reduce((sum, t) => sum + (t.amount || 0), 0);

    const currentPendingFeesTotal = await FeeRecord.countDocuments({
      status: { $in: ['pending', 'overdue'] }
    });
    
    const pendingFeesResolvedThisMonth = await FeeRecord.countDocuments({
      status: { $nin: ['pending', 'overdue'] },
      updatedAt: { $gte: currentMonthStart }
    });
    const pendingFeesCreatedThisMonth = await FeeRecord.countDocuments({
      status: { $in: ['pending', 'overdue'] },
      createdAt: { $gte: currentMonthStart }
    });
    const lastMonthPendingFees = currentPendingFeesTotal - pendingFeesCreatedThisMonth + pendingFeesResolvedThisMonth;

    const currentAlerts = await Alert.countDocuments({ isActive: true });
    const lastMonthAlerts = await Alert.countDocuments({
      isActive: true,
      createdAt: { $lte: lastMonthEnd }
    });

    const calculatePercentage = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.json({
      users: {
        current: totalUsersNow,
        previous: totalUsersLastMonth,
        percentage: calculatePercentage(totalUsersNow, totalUsersLastMonth)
      },
      jobs: {
        current: totalJobsNow,
        previous: totalJobsLastMonth,
        percentage: calculatePercentage(totalJobsNow, totalJobsLastMonth)
      },
      revenue: {
        current: currentMonthRevenue,
        previous: lastMonthRevenue,
        percentage: calculatePercentage(currentMonthRevenue, lastMonthRevenue)
      },
      pendingFees: {
        current: currentPendingFeesTotal,
        percentage: calculatePercentage(currentPendingFeesTotal, lastMonthPendingFees)
      },
      alerts: {
        current: currentAlerts,
        percentage: calculatePercentage(currentAlerts, lastMonthAlerts)
      }
    });
  } catch (error) {
    console.error('Error fetching stats comparison:', error);
    res.status(500).json({ error: 'Failed to fetch stats comparison' });
  }
};

module.exports = { getStats, getActivity, getAlerts, markAlertAsRead, getRevenueChart, getStatsComparison };
