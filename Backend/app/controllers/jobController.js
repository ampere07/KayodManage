const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { createActivityLog } = require('./activityLogController');

const getJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const search = req.query.search;
    const status = req.query.status;
    const category = req.query.category;
    const profession = req.query.profession;
    const paymentMethod = req.query.paymentMethod;
    const isUrgent = req.query.isUrgent;
    
    let query = {};
    
    // Filter archived jobs
    const archived = req.query.archived === 'true';
    const archiveType = req.query.archiveType;
    
    if (archived) {
      query.archived = true;
      if (archiveType && (archiveType === 'hidden' || archiveType === 'removed')) {
        query.archiveType = archiveType;
      }
    } else {
      query.archived = { $ne: true };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { professionName: { $regex: search, $options: 'i' } },
        { categoryName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (category && category !== 'all') {
      query.categoryName = { $regex: category, $options: 'i' };
    }
    
    if (profession && profession !== 'all') {
      query.professionName = { $regex: profession, $options: 'i' };
    }
    
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    if (isUrgent === 'true') {
      query.isUrgent = true;
    }
    
    // Fetch jobs and populate user virtuals
    const jobs = await Job.find(query)
      .populate('userId', 'name email userType profileImage')
      .populate('assignedToId', 'name email userType profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get job IDs for application count
    const jobIds = jobs.map(job => job._id);
    
    // Get application counts for each job
    const applicationCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$job', count: { $sum: 1 } } }
    ]);
    
    // Create a map of job ID to application count
    const countMap = {};
    applicationCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });
    
    // Add application count to each job
    const jobsWithData = jobs.map(job => {
      let locationDisplay = 'Location not specified';
      
      try {
        if (job.location && typeof job.location === 'object') {
          locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
        } else if (job.location && typeof job.location === 'string') {
          locationDisplay = job.location;
        }
      } catch (err) {
        console.error('Error parsing location for job:', job._id, err);
        locationDisplay = 'Location not specified';
      }
      
      return {
        ...job,
        user: job.userId,
        assignedTo: job.assignedToId,
        applicationCount: countMap[job._id.toString()] || 0,
        locationDisplay
      };
    });
    
    const total = await Job.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    // Calculate total value of ALL jobs (not filtered)
    const totalValueResult = await Job.aggregate([
      { $group: { _id: null, totalValue: { $sum: '$budget' } } }
    ]);
    const totalValue = totalValueResult.length > 0 ? totalValueResult[0].totalValue : 0;
    
    res.json({
      jobs: jobsWithData,
      pagination: {
        page,
        limit,
        total,
        pages
      },
      stats: {
        totalValue
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch jobs', message: error.message });
  }
};

const getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId)
      .populate('userId', 'name firstName lastName email phone userType profileImage location barangay city isVerified')
      .populate('assignedToId', 'name email phone userType profileImage')
      .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get applications for this job
    const applications = await Application.find({ job: jobId })
      .populate('provider', 'name email phone')
      .sort({ appliedAt: -1 })
      .lean();
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applications,
      applicationCount: applications.length,
      locationDisplay
    };
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error fetching job details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch job details', message: error.message });
  }
};

const updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['open', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const updateData = { status };
    
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: `status changed to ${status}`
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error updating job status:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update job status', message: error.message });
  }
};

const assignJobToProvider = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { providerId } = req.body;
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        assignedToId: providerId,
        status: 'in_progress'
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Application.findOneAndUpdate(
      { job: jobId, provider: providerId },
      { status: 'accepted' }
    );
    
    await Application.updateMany(
      { job: jobId, provider: { $ne: providerId } },
      { status: 'rejected' }
    );
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: 'assigned to provider'
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error assigning job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to assign job', message: error.message });
  }
};

const getJobStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const openJobs = await Job.countDocuments({ status: 'open' });
    const inProgressJobs = await Job.countDocuments({ status: 'in_progress' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });
    const cancelledJobs = await Job.countDocuments({ status: 'cancelled' });
    const urgentJobs = await Job.countDocuments({ isUrgent: true, status: { $in: ['open', 'in_progress'] } });
    
    const totalApplications = await Application.countDocuments();
    const pendingApplications = await Application.countDocuments({ status: 'pending' });
    
    res.json({
      totalJobs,
      openJobs,
      inProgressJobs,
      completedJobs,
      cancelledJobs,
      urgentJobs,
      totalApplications,
      pendingApplications
    });
  } catch (error) {
    console.error('Error fetching job stats:', error);
    res.status(500).json({ error: 'Failed to fetch job stats' });
  }
};

const hideJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('🔒 Hide Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        archived: true,
        archiveType: 'hidden',
        archivedAt: new Date(),
        isHidden: true,
        hiddenAt: new Date(),
        hiddenBy: adminName
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const notificationMessage = reason 
      ? `Your job "${job.title}" has been hidden by admin. Reason: ${reason}`
      : `Your job "${job.title}" has been hidden by admin for review.`;
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Hidden by Admin',
      message: notificationMessage,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'high',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        hiddenBy: adminName,
        hiddenAt: new Date(),
        reason: reason || 'No reason provided'
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_hidden');
      const activityLog = await createActivityLog(
        adminId,
        'job_hidden',
        `Hidden job "${job.title}" posted by ${job.userId.name}${reason ? `. Reason: ${reason}` : ''}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name,
            reason: reason || 'No reason provided'
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: 'hidden'
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error hiding job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to hide job', message: error.message });
  }
};

const unhideJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('🔓 Unhide Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        archived: false,
        archiveType: null,
        archivedAt: null,
        isHidden: false,
        hiddenAt: null,
        hiddenBy: null
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Restored',
      message: `Your job "${job.title}" has been restored and is now visible.`,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'medium',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        restoredBy: adminName,
        restoredAt: new Date()
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_unhidden');
      const activityLog = await createActivityLog(
        adminId,
        'job_unhidden',
        `Restored job "${job.title}" posted by ${job.userId.name}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: 'unhidden'
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error unhiding job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to unhide job', message: error.message });
  }
};

const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('🗑️ Delete Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        archived: true,
        archiveType: 'removed',
        archivedAt: new Date(),
        deletedBy: adminName
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Removed by Admin',
      message: `Your job "${job.title}" has been removed by administration.`,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'high',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        deletedBy: adminName,
        deletedAt: new Date()
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_deleted');
      const activityLog = await createActivityLog(
        adminId,
        'job_deleted',
        `Deleted job "${job.title}" posted by ${job.userId.name}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: { _id: job._id },
      updateType: 'deleted'
    });
    
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to delete job', message: error.message });
  }
};

const restoreJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('♻️ Restore Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        archived: false,
        archiveType: null,
        archivedAt: null,
        deletedBy: null,
        isHidden: false,
        hiddenAt: null,
        hiddenBy: null
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Restored',
      message: `Your job "${job.title}" has been restored by administration and is now visible.`,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'medium',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        restoredBy: adminName,
        restoredAt: new Date()
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_restored');
      const activityLog = await createActivityLog(
        adminId,
        'job_restored',
        `Restored job "${job.title}" posted by ${job.userId.name}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: { _id: job._id },
      updateType: 'restored'
    });
    
    res.json({ success: true, message: 'Job restored successfully' });
  } catch (error) {
    console.error('Error restoring job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to restore job', message: error.message });
  }
};

module.exports = { 
  getJobs, 
  getJobDetails, 
  updateJobStatus, 
  assignJobToProvider,
  getJobStats,
  hideJob,
  unhideJob,
  deleteJob,
  restoreJob
};
