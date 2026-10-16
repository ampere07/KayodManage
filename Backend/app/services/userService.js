const User = require('../models/User');
const Wallet = require('../models/Wallet');
const FeeRecord = require('../models/FeeRecord');
const mongoose = require('mongoose');

/**
 * User Service
 * Handles all business logic related to users
 */
class UserService {
  /**
   * Get users with pagination and filtering
   */
  async getUsers(query, pagination) {
    const { skip, limit } = pagination;

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const userIds = users.map(user => user._id);

    const wallets = await Wallet.find({ userId: { $in: userIds } }).lean();
    const feeRecords = await FeeRecord.find({ provider: { $in: userIds } }).lean();

    const walletMap = this._createWalletMap(wallets);
    const feeMap = this._createFeeMap(feeRecords);

    const usersWithData = users.map(user =>
      this._enrichUserData(user, walletMap, feeMap)
    );

    const total = await User.countDocuments(query);

    return {
      users: usersWithData,
      total
    };
  }

  /**
   * Get a single user by ID with related data
   */
  async getUserById(userId) {
    const user = await User.findById(userId).lean();
    if (!user) return null;

    const wallet = await Wallet.findOne({ userId }).lean();
    const feeRecords = await FeeRecord.find({ provider: userId }).lean();

    // Fetch verification record for audit details
    // If user is verified, search for the approved record first
    const CredentialVerification = require('../models/CredentialVerification');
    let verification = null;

    if (user.isVerified) {
      verification = await CredentialVerification.findOne({ userId, status: 'approved' })
        .populate('reviewedBy', 'name email')
        .sort({ reviewedAt: -1 })
        .lean();
    }

    // If still no record (not verified or approved record missing), get latest submission
    if (!verification) {
      verification = await CredentialVerification.findOne({ userId })
        .populate('reviewedBy', 'name email')
        .sort({ submittedAt: -1 })
        .lean();
    }

    const walletMap = this._createWalletMap(wallet ? [wallet] : []);
    const feeMap = this._createFeeMap(feeRecords);

    const enrichedUser = this._enrichUserData(user, walletMap, feeMap);
    return {
      ...enrichedUser,
      verificationAudit: verification || null
    };
  }

  /**
   * Restrict a user
   */
  async restrictUser(userId, restrictedBy, duration, reason) {
    const restrictionDetails = {
      type: 'restricted',
      reason: reason && reason.trim() ? reason.trim() : 'Account restricted by admin',
      restrictedAt: new Date(),
      appealAllowed: true
    };

    // Add expiration if duration is provided
    if (duration && duration > 0) {
      const expiresAt = new Date();
      // Convert days (including fractional) to milliseconds
      const durationMs = duration * 24 * 60 * 60 * 1000;
      expiresAt.setTime(expiresAt.getTime() + durationMs);
      restrictionDetails.expiresAt = expiresAt;
    }

    if (restrictedBy && mongoose.Types.ObjectId.isValid(restrictedBy)) {
      restrictionDetails.restrictedBy = restrictedBy;
    }

    const updateData = {
      isRestricted: true,
      accountStatus: 'restricted',
      restrictionDetails
    };

    return await User.findByIdAndUpdate(userId, updateData, { new: true });
  }

  /**
   * Remove restrictions from a user
   */
  async unrestrictUser(userId) {
    return await User.findByIdAndUpdate(
      userId,
      {
        accountStatus: 'active',
        isRestricted: false,
        $unset: { restrictionDetails: 1 }
      },
      { new: true }
    );
  }

  /**
   * Soft delete a user
   */
  async softDeleteUser(userId, reason, deletedBy) {
    const restrictionDetails = {
      type: 'deleted',
      reason: reason.trim(),
      restrictedAt: new Date(),
      appealAllowed: false
    };

    if (deletedBy && mongoose.Types.ObjectId.isValid(deletedBy)) {
      restrictionDetails.restrictedBy = deletedBy;
    }

    return await User.findByIdAndUpdate(
      userId,
      {
        accountStatus: 'deleted',
        isRestricted: true,
        restrictionDetails
      },
      { new: true }
    );
  }

  /**
   * Ban a user
   */
  async banUser(userId, reason, restrictedBy, duration) {
    const restrictionDetails = {
      type: 'banned',
      reason: reason.trim(),
      restrictedAt: new Date(),
      appealAllowed: true
    };

    // Add expiration if duration is provided
    if (duration && duration > 0) {
      const expiresAt = new Date();
      // Convert days (including fractional) to milliseconds
      const durationMs = duration * 24 * 60 * 60 * 1000;
      expiresAt.setTime(expiresAt.getTime() + durationMs);
      restrictionDetails.expiresAt = expiresAt;
    }

    if (restrictedBy && mongoose.Types.ObjectId.isValid(restrictedBy)) {
      restrictionDetails.restrictedBy = restrictedBy;
    }

    return await User.findByIdAndUpdate(
      userId,
      {
        accountStatus: 'banned',
        isRestricted: true,
        restrictionDetails
      },
      { new: true }
    );
  }

  /**
   * Suspend a user
   */
  async suspendUser(userId, reason, duration, restrictedBy) {
    const expiresAt = new Date();
    // Convert days (including fractional) to milliseconds
    const durationMs = (duration || 7) * 24 * 60 * 60 * 1000;
    expiresAt.setTime(expiresAt.getTime() + durationMs);

    const restrictionDetails = {
      type: 'suspended',
      reason: reason.trim(),
      restrictedAt: new Date(),
      suspendedUntil: expiresAt,
      expiresAt: expiresAt,
      appealAllowed: true
    };

    if (restrictedBy && mongoose.Types.ObjectId.isValid(restrictedBy)) {
      restrictionDetails.restrictedBy = restrictedBy;
    }

    return await User.findByIdAndUpdate(
      userId,
      {
        accountStatus: 'suspended',
        isRestricted: true,
        restrictionDetails
      },
      { new: true }
    );
  }

  /**
   * Update user verification status
   */
  async verifyUser(userId, verified) {
    return await User.findByIdAndUpdate(
      userId,
      { isVerified: verified },
      { new: true }
    );
  }

  /**
   * Build query for user filtering
   */
  buildUserQuery(filters) {
    const { search, status, userType, restricted, isVerified, accountStatus } = filters;
    const query = {};

    if (search) {
      const term = search.replace(/^KYD:\s*/i, '').trim();
      const orClauses = [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } }
      ];
      if (mongoose.Types.ObjectId.isValid(term)) {
        orClauses.push({ _id: new mongoose.Types.ObjectId(term) });
      }
      query.$or = orClauses;
    }

    if (status) {
      switch (status) {
        case 'verified':
          query.isVerified = true;
          break;
        case 'unverified':
          query.isVerified = false;
          break;
        case 'restricted':
          query.accountStatus = { $in: ['restricted', 'suspended', 'banned'] };
          break;
        case 'online':
          query.isOnline = true;
          break;
        case 'banned':
          query.accountStatus = 'banned';
          break;
        case 'suspended':
          query.accountStatus = 'suspended';
          break;
        case 'active':
          query.accountStatus = 'active';
          break;
      }
    }

    if (filters.profession) {
      const professionOr = [
        { categories: { $in: [filters.profession] } },
        { jobCategories: filters.profession },
        { jobCategories: { $in: [filters.profession] } },
        { category: filters.profession }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: professionOr }];
        delete query.$or;
      } else {
        query.$or = professionOr;
      }
    }

    // "Unverified" is anything not explicitly verified — a document without the
    // flag would otherwise belong to neither tab, and the tab counts (which come
    // from countUsersByFacet) would stop adding up to the total.
    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true' || isVerified === true ? true : { $ne: true };
    }

    // Comma-separated so the Users page can ask for "client,provider" and leave
    // staff accounts (admin, finance, support) out of the marketplace lists.
    const userTypes = String(userType || '')
      .split(',')
      .map(t => t.trim())
      .filter(t => t === 'client' || t === 'provider');
    if (userTypes.length === 1) {
      query.userType = userTypes[0];
    } else if (userTypes.length > 1) {
      query.userType = { $in: userTypes };
    }

    // Handle accountStatus filter (more specific than restricted)
    if (accountStatus) {
      // Support comma-separated values for multiple accountStatus
      if (accountStatus.includes(',')) {
        query.accountStatus = { $in: accountStatus.split(',').map(s => s.trim()) };
      } else {
        query.accountStatus = accountStatus;
      }
    }
    // Only use restricted filter if accountStatus is not specified
    else if (restricted === 'true') {
      const restrictedOr = [
        { accountStatus: { $in: ['restricted', 'suspended', 'banned'] } },
        { isRestricted: true }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: restrictedOr }];
        delete query.$or;
      } else {
        query.$or = restrictedOr;
      }
    }

    return query;
  }

  /**
   * Client/provider counts broken down by type × account status × verification,
   * under the same search and profession filters as the list.
   *
   * The Users page derives every card and tab number by summing these cells, so
   * each number always equals the rows that clicking it would show. One
   * aggregation replaces the ~20 `limit=1` list probes the page used to fire.
   */
  async countUsersByFacet({ search, profession } = {}) {
    const match = this.buildUserQuery({ search, profession });
    match.userType = { $in: ['client', 'provider'] };

    const rows = await User.aggregate([
      { $match: match },
      {
        $group: {
          _id: { userType: '$userType', accountStatus: '$accountStatus', isVerified: '$isVerified' },
          count: { $sum: 1 }
        }
      }
    ]);

    return rows.map(({ _id, count }) => ({
      userType: _id.userType,
      accountStatus: _id.accountStatus || 'active',
      isVerified: _id.isVerified === true,
      count
    }));
  }

  /**
   * Check and auto-unsuspend/unrestrict users
   */
  async checkSuspendedUsers() {
    const now = new Date();
    // Check for users with expired restrictions (any type)
    const result = await User.updateMany(
      {
        accountStatus: { $in: ['restricted', 'suspended', 'banned'] },
        'restrictionDetails.expiresAt': { $lte: now }
      },
      {
        accountStatus: 'active',
        isRestricted: false,
        $unset: { restrictionDetails: 1 }
      }
    );

    return result.modifiedCount;
  }

  /**
   * Private helper methods
   */
  _createWalletMap(wallets) {
    const map = {};
    wallets.forEach(wallet => {
      map[wallet.userId.toString()] = wallet;
    });
    return map;
  }

  _createFeeMap(feeRecords) {
    const map = {};
    feeRecords.forEach(fee => {
      const providerId = fee.provider.toString();
      if (!map[providerId]) {
        map[providerId] = [];
      }
      map[providerId].push(fee);
    });
    return map;
  }

  _enrichUserData(user, walletMap, feeMap) {
    const userId = user._id.toString();
    const wallet = walletMap[userId];
    const userFees = feeMap[userId] || [];

    const walletData = {
      balance: wallet ? wallet.balance : 0,
      availableBalance: wallet ? wallet.availableBalance : 0,
      heldBalance: wallet ? wallet.heldBalance : 0,
      currency: wallet ? wallet.currency : 'PHP',
      isActive: wallet ? wallet.isActive : false,
      isVerified: wallet ? wallet.isVerified : false
    };

    const feesData = userFees.map(fee => ({
      _id: fee._id,
      amount: fee.amount,
      dueDate: fee.dueDate,
      isPaid: fee.status === 'paid',
      status: fee.status,
      paymentMethod: fee.paymentMethod,
      createdAt: fee.createdAt
    }));

    return {
      ...user,
      wallet: walletData,
      fees: feesData
    };
  }
}

module.exports = new UserService();
