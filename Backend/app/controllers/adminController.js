const bcrypt = require('bcryptjs');
const ReportedPost = require('../models/ReportedPost');
const Job = require('../models/Job');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { formatPHPCurrency, formatBudgetResponse } = require('../utils/currency');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { auditLog, diffFields, describeChanges } = require('../utils/activityLogger');
const { AUDIT_ACTIONS, SENSITIVE_ACTION_TYPES } = require('../constants/auditActions');

// Get all reported posts with filtering and pagination
const getReportedPosts = async (req, res) => {
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

};

// Get a single reported post by ID
const getReportedPostById = async (req, res) => {
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

};

// Review a reported post and take action
const reviewReportedPost = async (req, res) => {
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
  // Canonical statuses only (constants/reportTaxonomy.js); 'reviewed'/'resolved'
  // are legacy values the enum rejects, and updates here skip validation.
  let newStatus = 'under_review';
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
      newStatus = 'action_taken';
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

  const jobTitle = reportedPost.jobId?.title;
  const outcomeText = action === 'delete' ? 'Deleted the reported job' : action === 'approve' ? 'Kept the reported job' : 'Dismissed the report on';
  await auditLog(req, 'report_reviewed', `${outcomeText}${jobTitle ? ` "${jobTitle}"` : ''}${adminNotes.trim() ? `. Note: ${adminNotes.trim()}` : ''}`, {
    targetType: 'report',
    targetId: reportedPost._id,
    targetModel: 'ReportedPost',
    metadata: { outcome: action, status: newStatus, actionTaken, targetName: jobTitle || null }
  });

  // Fetch updated data for response
  const updatedPost = await ReportedPost.findById(reportId)
    .populate('jobId', 'title description status isDeleted')
    .populate('reviewedBy', 'name email');

  res.json({
    success: true,
    message: `Report ${action === 'approve' ? 'approved - post kept' : action === 'delete' ? 'resolved - post deleted' : 'dismissed'} successfully`,
    reportedPost: updatedPost
  });

};

// Create a new report (for when users report posts)
const createReport = async (req, res) => {
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

};

// Get reports summary/statistics
const getReportsSummary = async (req, res) => {
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

};

// Bulk update reports (for batch operations)
const bulkUpdateReports = async (req, res) => {
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
      updateData.status = 'action_taken';
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

  const bulkVerb = action === 'delete' ? 'deleted the jobs on' : action === 'approve' ? 'kept the jobs on' : 'dismissed';
  await auditLog(req, 'reports_bulk_reviewed', `Bulk-${bulkVerb} ${result.modifiedCount} report${result.modifiedCount === 1 ? '' : 's'}`, {
    targetType: 'report',
    metadata: { outcome: action, count: result.modifiedCount, reportIds }
  });

  res.json({
    success: true,
    message: `Successfully ${action}ed ${result.modifiedCount} reports`,
    modifiedCount: result.modifiedCount
  });

};

const getAdminStats = async (req, res) => {
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
};

const getAllAdmins = async (req, res) => {
  const admins = await User.find({
    userType: { $in: ['admin', 'superadmin', 'finance', 'customer support', 'support'] }
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
};

const PERMISSION_LABELS = {
  dashboard: 'Dashboard',
  users: 'Users',
  jobs: 'Jobs',
  transactions: 'Transactions',
  verifications: 'Verifications',
  support: 'Support',
  activity: 'Activity',
  flagged: 'Flagged',
  settings: 'Settings'
};

/** Permission keys switched on and off between two permission maps. */
const permissionChanges = (before = {}, after = {}) => {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  return {
    granted: keys.filter((key) => !before?.[key] && Boolean(after?.[key])),
    revoked: keys.filter((key) => Boolean(before?.[key]) && !after?.[key])
  };
};

const logPermissionChanges = async (req, admin, before) => {
  const { granted, revoked } = permissionChanges(before, admin.toObject().permissions || {});
  if (!granted.length && !revoked.length) return;
  const label = (key) => PERMISSION_LABELS[key] || key;
  const parts = [
    granted.length && `granted ${granted.map(label).join(', ')}`,
    revoked.length && `revoked ${revoked.map(label).join(', ')}`
  ].filter(Boolean);
  await auditLog(req, 'admin_permissions_changed', `Changed ${admin.name}'s permissions: ${parts.join('; ')}`, {
    targetType: 'admin',
    targetId: admin._id,
    targetModel: 'User',
    metadata: { granted, revoked, targetName: admin.name }
  });
};

/**
 * Kayod must always keep one active superadmin, and nobody can take away their
 * own superadmin access or switch off their own account: either is one click
 * from a lockout nobody can undo from the app. Returns the refusal, or null.
 */
const superadminLockoutError = async (req, admin, nextRole, nextStatus) => {
  const isActiveSuperadmin = admin.userType === 'superadmin' && admin.accountStatus === 'active';
  const staysActiveSuperadmin = nextRole === 'superadmin' && nextStatus === 'active';
  if (!isActiveSuperadmin || staysActiveSuperadmin) return null;

  if (String(admin._id) === String(req.admin?.id)) {
    return nextStatus !== 'active'
      ? "You can't deactivate your own account"
      : "You can't remove your own superadmin access";
  }
  const otherSuperadmins = await User.countDocuments({
    _id: { $ne: admin._id },
    userType: 'superadmin',
    accountStatus: 'active'
  });
  return otherSuperadmins ? null : 'Kayod needs at least one active superadmin';
};

const updateAdminPermissions = async (req, res) => {
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
    userType: { $in: ['admin', 'superadmin', 'finance', 'customer support', 'support'] }
  });

  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  const permissionsBefore = admin.toObject().permissions || {};
  admin.permissions = permissions;
  await admin.save();

  await logPermissionChanges(req, admin, permissionsBefore);

  res.json({
    success: true,
    message: 'Permissions updated successfully',
    admin: {
      _id: admin._id,
      permissions: admin.permissions
    }
  });
};

const createAdmin = async (req, res) => {
  const { name, email, password, phone, userType, location, accountStatus, permissions } = req.body;

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
    accountStatus: accountStatus || 'active',
    categories: [],
    isVerified: true,
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

  const grantedOnCreate = Object.entries(newAdmin.toObject().permissions || {})
    .filter(([, allowed]) => allowed)
    .map(([key]) => key);
  await auditLog(req, 'admin_created', `Created ${newAdmin.userType} account for ${newAdmin.name} (${newAdmin.email})`, {
    targetType: 'admin',
    targetId: newAdmin._id,
    targetModel: 'User',
    metadata: { role: newAdmin.userType, accountStatus: newAdmin.accountStatus, granted: grantedOnCreate, targetName: newAdmin.name }
  });

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
};

const getAdminById = async (req, res) => {
  const { adminId } = req.params;

  const admin = await User.findOne({
    _id: adminId,
    userType: { $in: ['admin', 'superadmin', 'finance', 'customer support', 'support'] }
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
      accountStatus: admin.accountStatus,
      permissions: admin.permissions,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin
    }
  });
};

const updateAdmin = async (req, res) => {
  const { adminId } = req.params;
  const { name, email, phone, userType, location, accountStatus, permissions, newPassword } = req.body;

  if (!name || !email || !phone || !location) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  const admin = await User.findOne({
    _id: adminId,
    userType: { $in: ['admin', 'superadmin', 'finance', 'customer support', 'support'] }
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

  const lockout = await superadminLockoutError(
    req,
    admin,
    userType || admin.userType,
    accountStatus || admin.accountStatus
  );
  if (lockout) {
    return res.status(400).json({ success: false, message: lockout });
  }

  const before = admin.toObject();

  admin.name = name;
  admin.email = email;
  admin.phone = phone;
  if (userType) {
    admin.userType = userType;
  }
  admin.location = location;
  if (accountStatus) {
    admin.accountStatus = accountStatus;
  }
  // Turning an admin's access off uses the same account-status fields as a
  // user restriction, and the schema requires their details whenever the
  // status isn't active. Without them every "Suspended"/"Banned" save failed
  // validation, so there was no way to cut an admin off from here.
  if (accountStatus && accountStatus !== before.accountStatus) {
    if (accountStatus === 'active') {
      admin.restrictionDetails = undefined;
      admin.isRestricted = false;
    } else {
      admin.restrictionDetails = {
        type: accountStatus,
        reason: `Admin access turned off by ${req.admin?.name || 'a superadmin'}`,
        restrictedBy: req.admin?.id,
        restrictedAt: new Date(),
        // Lasts until a superadmin turns access back on. The schema requires an
        // end date for "suspended", so it gets the latest date a Date can hold.
        ...(accountStatus === 'suspended' ? { suspendedUntil: new Date(8.64e15) } : {}),
        appealAllowed: false
      };
    }
  }
  if (permissions) {
    admin.permissions = permissions;
  }

  const passwordReset = Boolean(newPassword && newPassword.trim() !== '');
  if (passwordReset) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
  }

  await admin.save();

  // One row per kind of change, so the sensitive ones (role, access,
  // permissions, password) can be filtered on and are never buried in an
  // "edited details" row.
  const audit = (actionType, description, metadata = {}) =>
    auditLog(req, actionType, description, {
      targetType: 'admin',
      targetId: admin._id,
      targetModel: 'User',
      metadata: { ...metadata, targetName: admin.name }
    });

  const profileChanges = diffFields(before, admin.toObject(), ['name', 'email', 'phone', 'location']);
  if (Object.keys(profileChanges).length) {
    await audit('admin_updated', `Edited ${admin.name}'s details: ${describeChanges(profileChanges)}`, { changes: profileChanges });
  }
  if (before.userType !== admin.userType) {
    await audit('admin_role_changed', `Changed ${admin.name}'s role from ${before.userType} to ${admin.userType}`, {
      changes: { role: { from: before.userType, to: admin.userType } }
    });
  }
  if (before.accountStatus !== admin.accountStatus) {
    // "Suspended Ana Cruz's admin account" / "Reactivated …"
    const verb = admin.accountStatus === 'active'
      ? 'Reactivated'
      : admin.accountStatus.charAt(0).toUpperCase() + admin.accountStatus.slice(1);
    await audit('admin_status_changed', `${verb} ${admin.name}'s admin account`, {
      changes: { accountStatus: { from: before.accountStatus, to: admin.accountStatus } }
    });
  }
  if (permissions) {
    await logPermissionChanges(req, admin, before.permissions || {});
  }
  if (passwordReset) {
    await audit('admin_password_reset', `Set a new password for ${admin.name}`);
  }

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
      accountStatus: admin.accountStatus,
      permissions: admin.permissions
    }
  });
};

/**
 * GET /api/admin/admins/:adminId/activity?page=&limit= — one admin's timeline
 * for the Edit Admin panel, plus what they've done in the last 30 days: how
 * much, how much of it sensitive, and which actions.
 */
const getAdminActivity = async (req, res) => {
  const { adminId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const admin = await User.findOne({
    _id: adminId,
    userType: { $in: ['admin', 'superadmin', 'finance', 'customer support', 'support'] }
  }).select('name lastLogin').lean();

  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  const adminObjectId = new mongoose.Types.ObjectId(adminId);
  const day = 24 * 60 * 60 * 1000;
  const since30 = new Date(Date.now() - 30 * day);
  const since7 = new Date(Date.now() - 7 * day);

  const [activities, total, byAction, last7d, lastAction] = await Promise.all([
    ActivityLog.find({ adminId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('targetId', 'name email title subject')
      .lean(),
    ActivityLog.countDocuments({ adminId }),
    ActivityLog.aggregate([
      { $match: { adminId: adminObjectId, createdAt: { $gte: since30 } } },
      { $group: { _id: '$actionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    ActivityLog.countDocuments({ adminId, createdAt: { $gte: since7 }, actionType: { $ne: 'admin_login' } }),
    ActivityLog.findOne({ adminId, actionType: { $ne: 'admin_login' } }).sort({ createdAt: -1 }).select('createdAt').lean()
  ]);

  const withoutLogins = byAction.filter((entry) => entry._id !== 'admin_login');

  const formattedActivities = activities.map((activity) => {
    const action = AUDIT_ACTIONS[activity.actionType];
    const target = activity.targetId && typeof activity.targetId === 'object' ? activity.targetId : null;
    return {
      _id: activity._id,
      actionType: activity.actionType,
      action: action?.label || activity.actionType,
      group: action?.group || null,
      sensitive: Boolean(action?.sensitive),
      description: activity.description,
      targetType: activity.targetType || null,
      targetName: target?.name || target?.title || target?.subject || activity.metadata?.targetName || null,
      metadata: activity.metadata || {},
      ipAddress: activity.ipAddress || null,
      createdAt: activity.createdAt
    };
  });

  res.json({
    success: true,
    activities: formattedActivities,
    total,
    page,
    limit,
    hasMore: page * limit < total,
    summary: {
      lastLogin: admin.lastLogin || null,
      lastActionAt: lastAction?.createdAt || null,
      last7d,
      last30d: withoutLogins.reduce((sum, entry) => sum + entry.count, 0),
      sensitive30d: withoutLogins
        .filter((entry) => SENSITIVE_ACTION_TYPES.includes(entry._id))
        .reduce((sum, entry) => sum + entry.count, 0),
      logins30d: byAction.find((entry) => entry._id === 'admin_login')?.count || 0,
      byAction30d: withoutLogins.map((entry) => ({
        actionType: entry._id,
        label: AUDIT_ACTIONS[entry._id]?.label || entry._id,
        group: AUDIT_ACTIONS[entry._id]?.group || null,
        sensitive: SENSITIVE_ACTION_TYPES.includes(entry._id),
        count: entry.count
      }))
    }
  });
};

const getAdminSessions = async (req, res) => {
  const { adminId } = req.params;

  const admin = await User.findOne({
    _id: adminId,
    userType: { $in: ['admin', 'superadmin', 'finance', 'customer support', 'support'] }
  });

  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  const sessionsCollection = mongoose.connection.db.collection('sessions');
  
  // Since sessions are stored as JSON strings, we need to fetch all and filter manually
  const allSessions = await sessionsCollection.find({}).toArray();
  
  console.log(`Total sessions in DB: ${allSessions.length}`);
  
  // Filter sessions by parsing the JSON string
  const sessions = allSessions.filter(session => {
    let sessionData;
    try {
      if (typeof session.session === 'string') {
        sessionData = JSON.parse(session.session);
      } else {
        sessionData = session.session;
      }
      
      // Check if this session belongs to the admin
      return sessionData.adminId === adminId || 
             sessionData.userId === adminId;
    } catch (e) {
      return false;
    }
  });

  console.log(`Found ${sessions.length} sessions for admin ${adminId}`);
  
  // Debug: Log first session if found
  if (sessions.length > 0) {
    let firstSessionData;
    try {
      firstSessionData = typeof sessions[0].session === 'string' 
        ? JSON.parse(sessions[0].session) 
        : sessions[0].session;
      console.log('Session data:', JSON.stringify(firstSessionData, null, 2));
    } catch (e) {
      console.log('Could not parse session data');
    }
  }

  const activeSessions = sessions.map(session => {
    let sessionData = session.session || {};
    
    // Handle case where session might be a JSON string
    if (typeof sessionData === 'string') {
      try {
        sessionData = JSON.parse(sessionData);
      } catch (e) {
        console.error('Failed to parse session data:', e);
        sessionData = {};
      }
    }
    
    const userAgent = sessionData.userAgent || 'Unknown';
    const ipAddress = sessionData.ipAddress || 'Unknown';
    
    let device = 'Unknown Device';
    let os = 'Unknown OS';
    
    // If userAgent is 'Unknown', this is an old session created before we added device tracking
    if (userAgent === 'Unknown') {
      device = 'Web Browser on Desktop';
      os = 'Unknown';
    } else if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      if (userAgent.includes('Android')) {
        device = 'Mobile App on Android';
        os = 'Android';
      } else if (userAgent.includes('iPhone') || userAgent.includes('iOS')) {
        device = 'Mobile App on iOS';
        os = 'iOS';
      } else {
        device = 'Mobile Device';
        os = 'Mobile';
      }
    } else {
      if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
        device = 'Chrome';
      } else if (userAgent.includes('Firefox')) {
        device = 'Firefox';
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        device = 'Safari';
      } else if (userAgent.includes('Edg')) {
        device = 'Edge';
      } else {
        device = 'Web Browser';
      }
      
      if (userAgent.includes('Windows')) {
        os = 'Windows';
      } else if (userAgent.includes('Mac')) {
        os = 'MacOS';
      } else if (userAgent.includes('Linux')) {
        os = 'Linux';
      } else {
        os = 'Desktop';
      }
      
      device = `${device} on ${os}`;
    }

    // Handle location - prioritize location field over IP
    let location;
    if (sessionData.location) {
      location = sessionData.location;
    } else if (ipAddress && ipAddress !== 'Unknown') {
      location = ipAddress;
    } else {
      location = 'Unknown';
    }
    
    const lastAccess = session.expires || new Date();
    const isCurrent = sessionData.sessionId === req.sessionID;

    return {
      _id: session._id,
      device,
      os,
      location,
      ipAddress,
      lastAccess,
      isCurrent,
      userAgent
    };
  });

  res.json({
    success: true,
    sessions: activeSessions
  });
};

module.exports = {
  getReportedPosts: asyncHandler(getReportedPosts, 'Failed to fetch reported posts'),
  getReportedPostById: asyncHandler(getReportedPostById, 'Failed to fetch reported post'),
  reviewReportedPost: asyncHandler(reviewReportedPost, 'Failed to review reported post'),
  createReport: asyncHandler(createReport, 'Failed to submit report'),
  getReportsSummary: asyncHandler(getReportsSummary, 'Failed to fetch reports summary'),
  bulkUpdateReports: asyncHandler(bulkUpdateReports, 'Failed to update reports'),
  getAdminStats: asyncHandler(getAdminStats, 'Server error: '),
  getAllAdmins: asyncHandler(getAllAdmins, 'Server error: '),
  getAdminById: asyncHandler(getAdminById, 'Server error: '),
  getAdminActivity: asyncHandler(getAdminActivity, 'Server error: '),
  getAdminSessions: asyncHandler(getAdminSessions, 'Server error: '),
  createAdmin: asyncHandler(createAdmin, 'Server error: '),
  updateAdmin: asyncHandler(updateAdmin, 'Server error: '),
  updateAdminPermissions: asyncHandler(updateAdminPermissions, 'Server error: '),
  // Exported for unit tests — the lockout rule is what stops the last
  // superadmin being removed from the app.
  _superadminLockoutError: superadminLockoutError,
  _permissionChanges: permissionChanges,
};
