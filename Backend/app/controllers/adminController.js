const bcrypt = require('bcryptjs');
const ReportedPost = require('../models/ReportedPost');
const Job = require('../models/Job');
const User = require('../models/User');
const { formatPHPCurrency, formatBudgetResponse } = require('../utils/currency');

// Get all reported posts with filtering and pagination
const getReportedPosts = async (req, res) => {
  try {
    const { 
      status = 'all', 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    // Build filter query
    let filterQuery = {};
    if (status !== 'all') {
      filterQuery.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get reported posts with populated data (including soft-deleted jobs)
    const reportedPosts = await ReportedPost.find(filterQuery)
      .populate({
        path: 'jobId',
        select: 'title description category location budget budgetType paymentMethod media icon createdAt status isDeleted deletedAt deletionReason',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('reportedBy', 'name email')
      .populate('jobPosterId', 'name email')
      .populate('reviewedBy', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await ReportedPost.countDocuments(filterQuery);
    
    // Get summary statistics
    const summary = await ReportedPost.getReportsSummary();

    // Format response data
    const formattedPosts = reportedPosts.map(post => {
      // Handle case where job might be deleted or missing
      if (!post.jobId) {
        return {
          ...post.toObject(),
          jobId: {
            _id: null,
            title: '[Job Not Found]',
            description: 'This job record is missing from the database',
            category: 'unknown',
            location: { address: 'Unknown', city: 'Unknown', region: 'Unknown' },
            budget: 0,
            budgetType: 'unknown',
            paymentMethod: 'unknown',
            media: [],
            icon: null,
            createdAt: post.createdAt,
            status: 'unknown',
            isDeleted: true,
            deletedAt: null,
            deletionReason: 'Record not found',
            formattedBudget: formatPHPCurrency(0)
          }
        };
      }

      // Enhance job data with formatted currency and media information
      const enhancedJob = {
        ...post.jobId.toObject(),
        formattedBudget: formatPHPCurrency(post.jobId.budget),
        budgetInfo: formatBudgetResponse(post.jobId.budget, post.jobId.budgetType),
        // Media information
        hasMedia: post.jobId.media && post.jobId.media.length > 0,
        mediaCount: post.jobId.media ? post.jobId.media.length : 0,
        mediaTypes: post.jobId.media ? post.jobId.media.map(url => {
          const extension = url.split('.').pop()?.toLowerCase();
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            return 'image';
          } else if (['mp4', 'webm', 'mov', 'avi'].includes(extension)) {
            return 'video';
          }
          return 'file';
        }) : [],
        // Deletion information
        isDeletionFromReport: post.jobId.isDeleted && post.jobId.deletionReason,
        deletionInfo: post.jobId.isDeleted ? {
          deletedAt: post.jobId.deletedAt,
          deletionReason: post.jobId.deletionReason,
          isDeletedFromReport: post.jobId.deletionReason && post.jobId.deletionReason.includes('report')
        } : null
      };

      return {
        ...post.toObject(),
        jobId: enhancedJob,
        reportedBy: {
          _id: post.reportedBy._id,
          providerId: post.reportedBy._id,
          providerName: post.reportedBy.name,
          providerEmail: post.reportedBy.email
        }
      };
    });

    res.json({
      success: true,
      reportedPosts: formattedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      },
      summary
    });

  } catch (error) {
    console.error('Error fetching reported posts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch reported posts',
      message: error.message 
    });
  }
};

// Get a single reported post by ID
const getReportedPostById = async (req, res) => {
  try {
    const { reportId } = req.params;

    const reportedPost = await ReportedPost.findById(reportId)
      .populate({
        path: 'jobId',
        select: 'title description category location budget budgetType paymentMethod media icon createdAt status user',
        populate: {
          path: 'user',
          select: 'name email phone'
        }
      })
      .populate('reportedBy', 'name email phone')
      .populate('jobPosterId', 'name email phone')
      .populate('reviewedBy', 'name email');

    if (!reportedPost) {
      return res.status(404).json({
        success: false,
        error: 'Reported post not found'
      });
    }

    // Enhance the response with job data
    let jobData;
    
    if (!reportedPost.jobId || !reportedPost.jobId.title) {
      // Job is deleted or missing, return minimal info
      jobData = {
        _id: 'deleted',
        title: '[Deleted Job]',
        description: 'This job has been deleted',
        category: 'unknown',
        location: { address: 'Unknown', city: 'Unknown', region: 'Unknown' },
        budget: 0,
        budgetType: 'unknown',
        paymentMethod: 'unknown',
        media: [],
        icon: null,
        createdAt: reportedPost.createdAt,
        status: 'deleted',
        user: { name: 'Unknown', email: 'unknown@example.com' },
        formattedBudget: formatPHPCurrency(0),
        budgetInfo: formatBudgetResponse(0, 'unknown'),
        isDeleted: true,
        hasMedia: false,
        mediaCount: 0
      };
    } else {
      // Job exists, use live data
      jobData = {
        ...reportedPost.jobId.toObject(),
        formattedBudget: formatPHPCurrency(reportedPost.jobId.budget),
        budgetInfo: formatBudgetResponse(reportedPost.jobId.budget, reportedPost.jobId.budgetType),
        isDeleted: false,
        hasMedia: reportedPost.jobId.media && reportedPost.jobId.media.length > 0,
        mediaCount: reportedPost.jobId.media ? reportedPost.jobId.media.length : 0
      };
    }
    
    // Helper function to determine if file is video
    function isVideoFile(filename) {
      if (!filename) return false;
      const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
      const extension = filename.toLowerCase().substr(filename.lastIndexOf('.'));
      return videoExtensions.includes(extension);
    }

    const enhancedReportedPost = {
      ...reportedPost.toObject(),
      jobId: jobData
    };

    res.json({
      success: true,
      reportedPost: enhancedReportedPost
    });

  } catch (error) {
    console.error('Error fetching reported post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reported post',
      message: error.message
    });
  }
};

// Review a reported post and take action
const reviewReportedPost = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, adminNotes = '' } = req.body; // Change back to adminNotes
    const adminUsername = req.session.username || 'admin';

    console.log('Reviewing reported post:', { reportId, action, adminUsername, adminNotes });

    if (!['approve', 'dismiss', 'delete'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be: approve, dismiss, or delete'
      });
    }

    // Find the reported post
    const reportedPost = await ReportedPost.findById(reportId)
      .populate('jobId');

    if (!reportedPost) {
      return res.status(404).json({
        success: false,
        error: 'Reported post not found'
      });
    }

    console.log('Original report comment:', reportedPost.comment);

    // Quick fix for legacy records with empty comment fields
    if (!reportedPost.comment || reportedPost.comment.trim() === '') {
      console.log(`Fixing empty comment for legacy report ${reportId}`);
      await ReportedPost.findByIdAndUpdate(reportId, { 
        comment: 'Legacy report - original comment missing' 
      });
    }

    // Determine the new status based on action
    let newStatus = 'reviewed';
    let actionTaken = 'none';

    switch (action) {
      case 'approve':
        newStatus = 'dismissed';
        actionTaken = 'post_approved';
        break;
      case 'dismiss':
        newStatus = 'dismissed';
        actionTaken = 'report_dismissed';
        break;
      case 'delete':
        // Delete the job but keep the report
        if (reportedPost.jobId && !reportedPost.jobId.isDeleted) {
          await Job.findByIdAndUpdate(
            reportedPost.jobId._id,
            { 
              status: 'cancelled',
              isDeleted: true,
              deletedAt: new Date(),
              deletionReason: `Deleted due to report: ${reportedPost.reason}`
            }
          );
        }
        newStatus = 'resolved';
        actionTaken = 'post_deleted';
        break;
    }

    // Update the report status and admin notes - NEVER touch the original comment
    const adminInfo = `[Reviewed by: ${adminUsername} on ${new Date().toISOString()}]`;
    const finalAdminNotes = adminInfo + (adminNotes.trim() ? ` - ${adminNotes.trim()}` : '');

    await ReportedPost.findByIdAndUpdate(
      reportId,
      {
        status: newStatus,
        reviewedAt: new Date(),
        actionTaken: actionTaken,
        adminNotes: finalAdminNotes
        // DO NOT update the comment field - leave it as is
      }
    );

    console.log(`Successfully reviewed report ${reportId} with action ${action}`);

    // Fetch updated data for response
    const updatedPost = await ReportedPost.findById(reportId)
      .populate('jobId', 'title description status isDeleted')
      .populate('reviewedBy', 'name email');

    res.json({
      success: true,
      message: `Report ${action === 'approve' ? 'approved - post kept' : action === 'delete' ? 'resolved - post deleted' : 'dismissed'} successfully`,
      reportedPost: updatedPost
    });

  } catch (error) {
    console.error('Error reviewing reported post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to review reported post',
      message: error.message
    });
  }
};

// Create a new report (for when users report posts)
const createReport = async (req, res) => {
  try {
    const { jobId, reason, comment } = req.body;
    const reporterId = req.session.userId || req.session.adminId; // Get user ID from session

    if (!jobId || !reason || !comment) {
      return res.status(400).json({
        success: false,
        error: 'Job ID, reason, and comment are required'
      });
    }

    // Check if job exists and get full job details with user info
    const job = await Job.findById(jobId).populate('user', 'name email phone');
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Check if user already reported this job
    const existingReport = await ReportedPost.findOne({
      jobId,
      reportedBy: reporterId
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        error: 'You have already reported this job'
      });
    }

    // Create new report without job snapshot
    const reportedPost = new ReportedPost({
      jobId,
      reportedBy: reporterId,
      jobPosterId: job.user._id,
      reason,
      comment: comment.trim(),
      reportMetadata: {
        reporterIP: req.ip,
        reporterUserAgent: req.get('User-Agent'),
        reportSource: 'web'
      }
    });

    await reportedPost.save();

    console.log(`New report created: ${reportedPost._id} for job ${jobId}`);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      reportId: reportedPost._id
    });

  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit report',
      message: error.message
    });
  }
};

// Get reports summary/statistics
const getReportsSummary = async (req, res) => {
  try {
    const summary = await ReportedPost.getReportsSummary();

    // Get additional statistics
    const recentReports = await ReportedPost.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const topReasons = await ReportedPost.aggregate([
      { $match: { status: { $ne: 'dismissed' } } },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      summary: {
        ...summary,
        recentReports,
        topReasons
      }
    });

  } catch (error) {
    console.error('Error fetching reports summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports summary',
      message: error.message
    });
  }
};

// Bulk update reports (for batch operations)
const bulkUpdateReports = async (req, res) => {
  try {
    const { reportIds, action, adminNotes = '' } = req.body;
    const adminId = req.session.adminId;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Report IDs array is required'
      });
    }

    if (!['approve', 'dismiss', 'delete'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

    let updateData = {
      reviewedBy: adminId,
      reviewedAt: new Date(),
      adminNotes: adminNotes.trim()
    };

    switch (action) {
      case 'approve':
      case 'dismiss':
        updateData.status = 'dismissed';
        updateData.actionTaken = 'report_dismissed';
        break;
      case 'delete':
        updateData.status = 'resolved';
        updateData.actionTaken = 'post_deleted';
        break;
    }

    // Always keep reported post records - never delete them
    // Update reported posts to track admin responses
    const adminInfo = `[Bulk review by: ${req.session.username || 'admin'} on ${new Date().toISOString()}]`;
    updateData.adminNotes = adminInfo + (adminNotes.trim() ? ` - ${adminNotes.trim()}` : '');
    
    // Remove reviewedBy from updateData since it causes ObjectId casting issues
    delete updateData.reviewedBy;
    
    const result = await ReportedPost.updateMany(
      { _id: { $in: reportIds } },
      updateData
    );

    // If deleting posts, only update the jobs table (keep reported posts)
    if (action === 'delete') {
      const reports = await ReportedPost.find({ _id: { $in: reportIds } });
      const jobIds = reports.map(r => r.jobId).filter(Boolean);
      
      if (jobIds.length > 0) {
        await Job.updateMany(
          { _id: { $in: jobIds } },
          { 
            status: 'cancelled',
            isDeleted: true,
            deletedAt: new Date(),
            deletionReason: 'Deleted due to bulk report review'
          }
        );
      }
    }

    res.json({
      success: true,
      message: `Successfully ${action}ed ${result.modifiedCount} reports`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error bulk updating reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update reports',
      message: error.message
    });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const adminId = req.user?.id || req.session?.adminId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin ID not found'
      });
    }

    const admin = await User.findById(adminId).select('name email ticketsResolved userType');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      stats: {
        name: admin.name,
        email: admin.email,
        ticketsResolved: admin.ticketsResolved || 0,
        userType: admin.userType
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({
      userType: { $in: ['admin', 'superadmin', 'finance', 'customer support'] }
    }).select('name email userType accountStatus createdAt lastLogin permissions');

    const formattedAdmins = admins.map(admin => ({
      _id: admin._id,
      uid: `KYD-${admin._id.toString().slice(-6).toUpperCase()}`,
      fullName: admin.name,
      email: admin.email,
      role: admin.userType.charAt(0).toUpperCase() + admin.userType.slice(1),
      permissions: admin.permissions || {
        dashboard: true,
        users: true,
        jobs: true,
        transactions: true,
        verifications: true,
        support: true,
        activity: true,
        flagged: true,
        settings: false
      },
      accountStatus: admin.accountStatus,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin
    }));

    res.json({
      success: true,
      admins: formattedAdmins
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

const updateAdminPermissions = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { permissions } = req.body;

    if (!permissions) {
      return res.status(400).json({
        success: false,
        message: 'Permissions are required'
      });
    }

    const admin = await User.findOne({
      _id: adminId,
      userType: { $in: ['admin', 'superadmin', 'finance', 'customer support'] }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    admin.permissions = permissions;
    await admin.save();

    res.json({
      success: true,
      message: 'Permissions updated successfully',
      admin: {
        _id: admin._id,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Error updating admin permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, userType, location, permissions } = req.body;

    if (!name || !email || !password || !phone || !location) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      userType: userType || 'admin',
      location,
      categories: [],
      isVerified: true,
      accountStatus: 'active',
      restrictionDetails: {
        isRestricted: false,
        appealAllowed: true
      },
      isOnline: false,
      ticketsResolved: 0,
      ticketsSubmittedResolved: 0,
      permissions: permissions || {
        dashboard: false,
        users: false,
        jobs: false,
        transactions: false,
        verifications: false,
        support: false,
        activity: false,
        flagged: false,
        settings: false
      }
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        _id: newAdmin._id,
        uid: `KYD-${newAdmin._id.toString().slice(-6).toUpperCase()}`,
        name: newAdmin.name,
        email: newAdmin.email,
        userType: newAdmin.userType,
        permissions: newAdmin.permissions
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

const getAdminById = async (req, res) => {
  try {
    const { adminId } = req.params;

    const admin = await User.findOne({
      _id: adminId,
      userType: { $in: ['admin', 'superadmin', 'finance', 'customer support'] }
    }).select('name email phone userType location accountStatus createdAt lastLogin permissions');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        userType: admin.userType,
        location: admin.location,
        permissions: admin.permissions,
        accountStatus: admin.accountStatus,
        createdAt: admin.createdAt,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    console.error('Error fetching admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

const updateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { name, email, phone, userType, location, permissions, newPassword } = req.body;

    if (!name || !email || !phone || !location) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const admin = await User.findOne({
      _id: adminId,
      userType: { $in: ['admin', 'superadmin', 'finance', 'customer support'] }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (email !== admin.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: adminId } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    admin.name = name;
    admin.email = email;
    admin.phone = phone;
    admin.userType = userType;
    admin.location = location;
    if (permissions) {
      admin.permissions = permissions;
    }

    if (newPassword && newPassword.trim() !== '') {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      admin.password = hashedPassword;
    }

    await admin.save();

    res.json({
      success: true,
      message: 'Admin updated successfully',
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        userType: admin.userType,
        location: admin.location,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

module.exports = {
  getReportedPosts,
  getReportedPostById,
  reviewReportedPost,
  createReport,
  getReportsSummary,
  bulkUpdateReports,
  getAdminStats,
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  updateAdminPermissions
};