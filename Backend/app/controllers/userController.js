const userService = require('../services/userService');
const userActivityService = require('../services/userActivityService');
const { logActivity, auditLog } = require('../utils/activityLogger');
const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');

// A malformed id reaches the service as a cast failure, which surfaces as a
// 500 for what is really a bad request. Checked once, up front, by the three
// history endpoints below.
const isValidUserId = (userId) => mongoose.Types.ObjectId.isValid(userId);

// "for 7 days" / "indefinitely" — restrictions and bans without a duration don't expire.
const forHowLong = (duration) => {
  const days = Number(duration);
  return days > 0 ? `for ${days} day${days === 1 ? '' : 's'}` : 'indefinitely';
};

const getUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const filters = {
    search: req.query.search,
    status: req.query.status,
    userType: req.query.userType,
    restricted: req.query.restricted,
    isVerified: req.query.isVerified,
    accountStatus: req.query.accountStatus,
    profession: req.query.profession
  };
  
  const query = userService.buildUserQuery(filters);
  const pagination = { skip, limit };
  
  const { users, total } = await userService.getUsers(query, pagination);
  const pages = Math.ceil(total / limit);

  // Top-up and cash-out totals for exactly the rows being returned, so the
  // list can show what each user has moved without a request per row.
  const financials = await userActivityService.getFinancialTotalsForUsers(
    users.map(user => user._id)
  );
  const usersWithFinancials = users.map(user => ({
    ...user,
    financials: financials[String(user._id)] || {
      topUpTotal: 0,
      topUpPending: 0,
      cashOutTotal: 0,
      cashOutPending: 0
    }
  }));

  res.json({
    users: usersWithFinancials,
    pagination: {
      page,
      limit,
      total,
      pages
    }
  });
};

const getUserCounts = async (req, res) => {
  const cells = await userService.countUsersByFacet({
    search: req.query.search,
    profession: req.query.profession
  });

  res.json({ success: true, cells });
};

const getUserDetails = async (req, res) => {
  const { userId } = req.params;
  
  const user = await userService.getUserById(userId);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  
  res.json(user);
};

const restrictUser = async (req, res) => {
  const { userId } = req.params;
  const { restricted, duration, reason } = req.body;
  
  let user;
  if (restricted) {
    user = await userService.restrictUser(userId, req.session.adminId, duration, reason);
  } else {
    user = await userService.unrestrictUser(userId);
  }
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const userWithData = await userService.getUserById(userId);
  
  if (req.user && req.user.id) {
    await logActivity(
      req.user.id,
      restricted ? 'user_restricted' : 'user_unrestricted',
      restricted ? `Restricted user ${user.name} ${forHowLong(duration)}` : `Removed restrictions from ${user.name}`,
      {
        targetType: 'user',
        targetId: userId,
        targetModel: 'User',
        metadata: restricted
          ? { reason: reason || null, duration: Number(duration) > 0 ? Number(duration) : -1, expiresAt: user.restrictionDetails?.expiresAt || null }
          : reason ? { reason } : undefined,
        ipAddress: req.ip
      }
    );
  }
  
  const { io } = require('../../server');
  io.to('admin').emit('user:updated', {
    user: userWithData,
    updateType: restricted ? 'restricted' : 'unrestricted'
  });
  
  res.json(userWithData);
};

const banUser = async (req, res) => {
  const { userId } = req.params;
  const { reason, duration } = req.body;
  
  if (!reason || reason.trim().length === 0) {
    throw ApiError.badRequest('Ban reason is required');
  }
  
  const user = await userService.banUser(userId, reason, req.session.adminId, duration);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const userWithData = await userService.getUserById(userId);
  
  if (req.user && req.user.id) {
    await logActivity(
      req.user.id,
      'user_banned',
      `Banned user ${user.name} ${forHowLong(duration)}`,
      {
        targetType: 'user',
        targetId: userId,
        targetModel: 'User',
        metadata: { reason, duration: Number(duration) > 0 ? Number(duration) : -1, expiresAt: user.restrictionDetails?.expiresAt || null },
        ipAddress: req.ip
      }
    );
  }
  
  const { io } = require('../../server');
  io.to('admin').emit('user:updated', {
    user: userWithData,
    updateType: 'banned'
  });
  
  res.json(userWithData);
};

const suspendUser = async (req, res) => {
  const { userId } = req.params;
  const { reason, duration } = req.body;
  
  if (!reason || reason.trim().length === 0) {
    throw ApiError.badRequest('Suspension reason is required');
  }
  
  if (!duration || duration <= 0) {
    throw ApiError.badRequest('Valid suspension duration is required');
  }
  
  const user = await userService.suspendUser(userId, reason, duration, req.session.adminId);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const userWithData = await userService.getUserById(userId);
  
  if (req.user && req.user.id) {
    await logActivity(
      req.user.id,
      'user_suspended',
      `Suspended user ${user.name} for ${duration} days`,
      {
        targetType: 'user',
        targetId: userId,
        targetModel: 'User',
        metadata: { reason, duration, suspendedUntil: user.restrictionDetails.suspendedUntil },
        ipAddress: req.ip
      }
    );
  }
  
  const { io } = require('../../server');
  io.to('admin').emit('user:updated', {
    user: userWithData,
    updateType: 'suspended'
  });
  
  res.json(userWithData);
};

const unrestrictUser = async (req, res) => {
  const { userId } = req.params;
  
  const user = await userService.unrestrictUser(userId);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const userWithData = await userService.getUserById(userId);
  
  if (req.user && req.user.id) {
    await logActivity(
      req.user.id,
      'user_unrestricted',
      `Removed restrictions from ${user.name}`,
      {
        targetType: 'user',
        targetId: userId,
        targetModel: 'User',
        ipAddress: req.ip
      }
    );
  }
  
  const { io } = require('../../server');
  io.to('admin').emit('user:updated', {
    user: userWithData,
    updateType: 'unrestricted'
  });
  
  res.json(userWithData);
};

const verifyUser = async (req, res) => {
  const { userId } = req.params;
  const { verified } = req.body;
  
  const user = await userService.verifyUser(userId, verified);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const userWithData = await userService.getUserById(userId);
  
  const { io } = require('../../server');
  io.to('admin').emit('user:updated', {
    user: userWithData,
    updateType: verified ? 'verified' : 'unverified'
  });

  await auditLog(
    req,
    verified ? 'user_verified' : 'user_unverified',
    verified ? `Marked ${user.name} as verified` : `Removed verification from ${user.name}`,
    { targetType: 'user', targetId: userId, targetModel: 'User', metadata: { targetName: user.name } }
  );

  res.json(userWithData);
};

// How often a user has been restricted, suspended or banned, for the Users side
// modal. The audit log itself is superadmin-only; this exposes only the count
// and the latest date, for one user.
const PENALTY_ACTIONS = ['user_restricted', 'user_suspended', 'user_banned'];

const getUserPenalties = async (req, res) => {
  const { userId } = req.params;
  if (!isValidUserId(userId)) {
    throw ApiError.badRequest('Invalid userId');
  }

  const query = { targetId: new mongoose.Types.ObjectId(userId), actionType: { $in: PENALTY_ACTIONS } };
  const [totalPenalties, latest] = await Promise.all([
    ActivityLog.countDocuments(query),
    ActivityLog.findOne(query).sort({ createdAt: -1 }).select('createdAt').lean()
  ]);

  res.json({ success: true, totalPenalties, lastPenalty: latest?.createdAt || null });
};

const softDeleteUser = async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  
  if (!reason || reason.trim().length === 0) {
    throw ApiError.badRequest('Delete reason is required');
  }
  
  const user = await userService.softDeleteUser(userId, reason, req.session.adminId);
  
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const userWithData = await userService.getUserById(userId);
  
  if (req.user && req.user.id) {
    await logActivity(
      req.user.id,
      'user_deleted',
      `Soft deleted user ${user.name}`,
      {
        targetType: 'user',
        targetId: userId,
        targetModel: 'User',
        metadata: { reason },
        ipAddress: req.ip
      }
    );
  }
  
  const { io } = require('../../server');
  io.to('admin').emit('user:updated', {
    user: userWithData,
    updateType: 'deleted'
  });
  
  res.json(userWithData);
};

const getUserActivity = async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    throw ApiError.badRequest('Invalid user id');
  }
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 25, 100);
  const types = req.query.types
    ? String(req.query.types).split(',').map(t => t.trim()).filter(Boolean)
    : null;

  const result = await userActivityService.getUserActivity(userId, { page, limit, types });

  res.json(result);
};

const getUserJobs = async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    throw ApiError.badRequest('Invalid user id');
  }
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const role = req.query.role || 'all';

  const result = await userActivityService.getUserJobs(userId, { page, limit, role });

  res.json(result);
};

const getUserReviews = async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    throw ApiError.badRequest('Invalid user id');
  }
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const rating = [1, 2, 3, 4, 5].includes(Number(req.query.rating)) ? Number(req.query.rating) : undefined;

  const result = await userActivityService.getProviderReviews(userId, { page, limit, rating });

  res.json(result);
};

const getUserStanding = async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    throw ApiError.badRequest('Invalid user id');
  }

  res.json(await userActivityService.getUserStanding(userId));
};

const getUserFinancials = async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    throw ApiError.badRequest('Invalid user id');
  }

  const result = await userActivityService.getUserFinancials(userId);

  res.json(result);
};

const checkSuspendedUsers = async () => {
  try {
    const count = await userService.checkSuspendedUsers();
    if (count > 0) {
      console.log(`Auto-unsuspended ${count} users`);
    }
  } catch (error) {
    console.error('Error checking suspended users:', error);
  }
};

module.exports = {
  getUsers: asyncHandler(getUsers, 'Failed to fetch users'),
  getUserCounts: asyncHandler(getUserCounts, 'Failed to count users'),
  restrictUser: asyncHandler(restrictUser, 'Failed to update user restriction'),
  banUser: asyncHandler(banUser, 'Failed to ban user'),
  suspendUser: asyncHandler(suspendUser, 'Failed to suspend user'),
  unrestrictUser: asyncHandler(unrestrictUser, 'Failed to unrestrict user'),
  verifyUser: asyncHandler(verifyUser, 'Failed to update user verification'),
  getUserDetails: asyncHandler(getUserDetails, 'Failed to fetch user details'),
  softDeleteUser: asyncHandler(softDeleteUser, 'Failed to soft delete user'),
  getUserActivity: asyncHandler(getUserActivity, 'Failed to fetch user activity'),
  getUserJobs: asyncHandler(getUserJobs, 'Failed to fetch user jobs'),
  getUserFinancials: asyncHandler(getUserFinancials, 'Failed to fetch user financials'),
  getUserReviews: asyncHandler(getUserReviews, 'Failed to fetch user reviews'),
  getUserStanding: asyncHandler(getUserStanding, 'Failed to fetch user standing'),
  getUserPenalties: asyncHandler(getUserPenalties, 'Failed to fetch user penalties'),
  checkSuspendedUsers,
};
