const mongoose = require('mongoose');
const CredentialVerification = require('../models/CredentialVerification');
const User = require('../models/User');

/**
 * Verification Service
 * Handles all business logic related to credential verifications
 */
class VerificationService {
  /**
   * Get all verifications with optional filtering
   */
  async getAllVerifications(filters = {}) {
    const { status, limit = 50, skip = 0 } = filters;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const verifications = await CredentialVerification.find(query)
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    return verifications;
  }

  /**
   * Get a single verification by ID
   */
  async getVerificationById(verificationId) {
    const verification = await CredentialVerification.findById(verificationId)
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email')
      .lean();

    return verification;
  }

  /**
   * Update verification status
   */
  async updateVerificationStatus(verificationId, statusData, reviewerId) {
    const { status, adminNotes, rejectionReason, banUser } = statusData;

    const validStatuses = ['pending', 'approved', 'rejected', 'under_review', 'resubmission_requested', 'flagged'];
    console.log('📥 RECEIVED RAW STATUS:', JSON.stringify(status));

    // Normalize status
    let normalizedStatus = status?.trim()?.toLowerCase();

    // Lenient mapping for common variations
    const statusMapping = {
      'resubmission_requested': 'resubmission_requested',
      'resubmission requested': 'resubmission_requested',
      'request resubmission': 'resubmission_requested',
      'request for resubmission': 'resubmission_requested',
      'reqeust for resubmission': 'resubmission_requested',
      'resubmit': 'resubmission_requested'
    };

    if (statusMapping[normalizedStatus]) {
      normalizedStatus = statusMapping[normalizedStatus];
    }

    // Update the local status variable to use the normalized one
    const finalStatus = normalizedStatus;

    if (!validStatuses.includes(finalStatus)) {
      console.error(`❌ INVALID STATUS REJECTED: "${finalStatus}" (Original: "${status}")`);
      throw new Error(`Invalid status value: ${finalStatus}`);
    }

    // Ensure we use the finalStatus for the rest of the function
    const statusToUse = finalStatus;

    if (statusToUse === 'rejected' && (!rejectionReason || rejectionReason.trim() === '')) {
      throw new Error('Rejection reason is required when rejecting a verification');
    }

    const updateData = {
      status: statusToUse,
      adminNotes,
      reviewedAt: new Date(),
      reviewedBy: mongoose.Types.ObjectId.isValid(reviewerId) ? reviewerId : null
    };

    console.log('📝 LOG: updateData to be applied:', JSON.stringify(updateData, null, 2));

    if (statusToUse === 'rejected' || statusToUse === 'resubmission_requested' || statusToUse === 'flagged') {
      updateData.rejectionReason = rejectionReason;
    }

    // Use a transaction or at least update both if needed
    // Use updateOne to bypass any potential schema validation issues that findByIdAndUpdate might trigger
    const updatedVerification = await CredentialVerification.findByIdAndUpdate(
      verificationId,
      { $set: updateData },
      { new: true }
    )
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email');

    if (!updatedVerification) {
      throw new Error('Verification not found');
    }

    // Sync verification status and account status to User model
    if (updatedVerification?.userId) {
      const userUpdate = { credentialVerificationStatus: statusToUse };

      if (statusToUse === 'approved') {
        userUpdate.isVerified = true;
      } else if (statusToUse === 'rejected') {
        userUpdate.isVerified = false;

        if (banUser) {
          userUpdate.accountStatus = 'banned';
          userUpdate.restrictionDetails = {
            type: 'banned',
            reason: rejectionReason || 'Verification rejected and user banned',
            restrictedBy: reviewerId,
            restrictedAt: new Date(),
            appealAllowed: false,
            expiresAt: null
          };
        }
      } else {
        userUpdate.isVerified = false;
      }

      try {
        console.log('👤 LOG: Updating user status with:', JSON.stringify(userUpdate, null, 2));
        const userUpdateResult = await User.updateOne(
          { _id: updatedVerification.userId._id || updatedVerification.userId },
          { $set: userUpdate }
        );
        console.log('✅ User update result:', JSON.stringify(userUpdateResult, null, 2));
      } catch (userError) {
        console.error('❌ User Sync Error:', userError.message);
        console.error('User Update Data:', JSON.stringify(userUpdate, null, 2));
        // We don't necessarily want to fail the whole verification update if the user sync fails,
        // but it's good to know. However, for debugging 400, we should probably know if it's hitting here.
        throw userError;
      }
    }

    return updatedVerification.toObject();
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats() {
    const stats = await CredentialVerification.aggregate([
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          total: [
            {
              $count: 'count'
            }
          ]
        }
      }
    ]);

    const statusCounts = stats[0].statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const total = stats[0].total[0]?.count || 0;

    return {
      total,
      pending: statusCounts.pending || 0,
      approved: statusCounts.approved || 0,
      rejected: statusCounts.rejected || 0,
      under_review: statusCounts.under_review || 0,
      resubmission_requested: statusCounts.resubmission_requested || 0,
      flagged: statusCounts.flagged || 0
    };
  }

  /**
   * Get latest verification for a user
   */
  async getVerificationByUserId(userId) {
    const verification = await CredentialVerification.findOne({ userId })
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .lean();

    return verification;
  }

  /**
   * Get user images from latest verification
   */
  async getUserImages(userId) {
    const verifications = await CredentialVerification.find({ userId })
      .sort({ submittedAt: -1 })
      .limit(1)
      .lean();

    if (!verifications || verifications.length === 0) {
      return null;
    }

    const verification = verifications[0];
    return {
      userId,
      images: {
        faceVerification: verification.faceVerification,
        validId: verification.validId,
        credentials: verification.credentials
      }
    };
  }
}

module.exports = new VerificationService();
