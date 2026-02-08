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
    const { status, adminNotes, rejectionReason } = statusData;

    const validStatuses = ['approved', 'rejected', 'under_review'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status value');
    }

    if (status === 'rejected' && (!rejectionReason || rejectionReason.trim() === '')) {
      throw new Error('Rejection reason is required when rejecting a verification');
    }

    const updateData = {
      status,
      adminNotes,
      reviewedAt: new Date(),
      reviewedBy: reviewerId
    };

    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason;
    }

    // Use a transaction or at least update both if needed
    const verification = await CredentialVerification.findByIdAndUpdate(
      verificationId,
      updateData,
      { new: true }
    )
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email');

    if (!verification) {
      throw new Error('Verification not found');
    }

    // Sync isVerified status to User model
    if (status === 'approved') {
      await User.findByIdAndUpdate(verification.userId._id, { isVerified: true });
    } else if (status === 'rejected') {
      await User.findByIdAndUpdate(verification.userId._id, { isVerified: false });
    }

    return verification.toObject();
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
      under_review: statusCounts.under_review || 0
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
