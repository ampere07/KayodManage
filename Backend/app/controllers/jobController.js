const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');

const getJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const search = req.query.search;
    const status = req.query.status;
    const category = req.query.category;
    const paymentMethod = req.query.paymentMethod;
    const isUrgent = req.query.isUrgent;
    
    let query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by category
    if (category && category !== 'all') {
      query.category = { $regex: category, $options: 'i' };
    }
    
    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    // Filter by urgency
    if (isUrgent === 'true') {
      query.isUrgent = true;
    }
    
    console.log('Jobs query:', query); // Debug log
    
    // Fetch jobs with populated user data
    const jobs = await Job.find(query)
      .populate('user', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`Found ${jobs.length} jobs`); // Debug log

    // Get job IDs for application count
    const jobIds = jobs.map(job => job._id);
    
    // Get application counts for each job
    const applicationCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$job', count: { $sum: 1 } } }
    ]);
    
    console.log(`Found application counts for ${applicationCounts.length} jobs`); // Debug log
    
    // Create a map of job ID to application count
    const countMap = {};
    applicationCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });
    
    // Add application count to each job
    const jobsWithData = jobs.map(job => ({
      ...job,
      applicationCount: countMap[job._id.toString()] || 0,
      // Format location for display
      locationDisplay: typeof job.location === 'object' ? 
        job.location.address || job.location.city || 'Location not specified' : 
        job.location || 'Location not specified'
    }));
    
    const total = await Job.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    res.json({
      jobs: jobsWithData,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

const getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId)
      .populate('user', 'name email phone')
      .populate('assignedTo', 'name email phone')
      .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get applications for this job
    const applications = await Application.find({ job: jobId })
      .populate('provider', 'name email phone')
      .sort({ appliedAt: -1 })
      .lean();
    
    // Format location for display
    const locationDisplay = typeof job.location === 'object' ? 
      job.location.address || job.location.city || 'Location not specified' : 
      job.location || 'Location not specified';
    
    const jobWithData = {
      ...job,
      applications,
      applicationCount: applications.length,
      locationDisplay
    };
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
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
    
    // Set completion date if marking as completed
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    )
    .populate('user', 'name email')
    .populate('assignedTo', 'name email')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get application count
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    const jobWithData = {
      ...job,
      applicationCount,
      locationDisplay: typeof job.location === 'object' ? 
        job.location.address || job.location.city || 'Location not specified' : 
        job.location || 'Location not specified'
    };
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: `status changed to ${status}`
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
};

const assignJobToProvider = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { providerId } = req.body;
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        assignedTo: providerId,
        status: 'in_progress'
      },
      { new: true }
    )
    .populate('user', 'name email')
    .populate('assignedTo', 'name email')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Update the accepted application
    await Application.findOneAndUpdate(
      { job: jobId, provider: providerId },
      { status: 'accepted' }
    );
    
    // Reject other applications
    await Application.updateMany(
      { job: jobId, provider: { $ne: providerId } },
      { status: 'rejected' }
    );
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    const jobWithData = {
      ...job,
      applicationCount,
      locationDisplay: typeof job.location === 'object' ? 
        job.location.address || job.location.city || 'Location not specified' : 
        job.location || 'Location not specified'
    };
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: 'assigned to provider'
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error assigning job:', error);
    res.status(500).json({ error: 'Failed to assign job' });
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

module.exports = { 
  getJobs, 
  getJobDetails, 
  updateJobStatus, 
  assignJobToProvider,
  getJobStats 
};