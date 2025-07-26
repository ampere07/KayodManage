const Job = require('../models/Job');

const getJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const status = req.query.status;
    const category = req.query.category;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    const jobs = await Job.find(query)
      .populate('clientId', 'name email')
      .populate('providerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Job.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    res.json({
      jobs,
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

const updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    
    const updateData = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const job = await Job.findByIdAndUpdate(jobId, updateData, { new: true })
      .populate('clientId', 'name email')
      .populate('providerId', 'name email');
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job,
      updateType: `marked as ${status}`
    });
    
    res.json(job);
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
};

module.exports = { getJobs, updateJobStatus };