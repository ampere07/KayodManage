const CredentialVerification = require('../models/CredentialVerification');
const { logActivity } = require('../utils/activityLogger');

const getAllVerifications = async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const verifications = await CredentialVerification.find(query)
      .populate('userId', 'name email userType profileImage')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    res.json({
      success: true,
      data: verifications
    });
  } catch (error) {
    console.error('Error fetching verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verifications',
      error: error.message
    });
  }
};

const getVerificationById = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await CredentialVerification.findById(verificationId)
      .populate('userId', 'name email userType profileImage')
      .populate('reviewedBy', 'name email')
      .lean();

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Verification not found'
      });
    }

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('Error fetching verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verification details',
      error: error.message
    });
  }
};

const updateVerificationStatus = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, adminNotes, rejectionReason } = req.body;

    const validStatuses = ['approved', 'rejected', 'under_review'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    if (status === 'rejected' && (!rejectionReason || rejectionReason.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a verification'
      });
    }

    const updateData = {
      status,
      adminNotes,
      reviewedAt: new Date(),
      reviewedBy: req.user?._id
    };

    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason;
    }

    const verification = await CredentialVerification.findByIdAndUpdate(
      verificationId,
      updateData,
      { new: true }
    )
      .populate('userId', 'name email userType profileImage')
      .populate('reviewedBy', 'name email')
      .lean();

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Verification not found'
      });
    }

    console.log('✅ Verification status updated successfully');

    if (status === 'approved' || status === 'rejected') {
      const actionType = status === 'approved' ? 'verification_approved' : 'verification_rejected';
      const description = status === 'approved' 
        ? `Approved verification for ${verification.userId.name}`
        : `Rejected verification for ${verification.userId.name}`;
      
      await logActivity(
        req.user.id,
        actionType,
        description,
        {
          targetType: 'verification',
          targetId: verification.userId._id,
          targetModel: 'User',
          metadata: {
            verificationId: verification._id,
            rejectionReason: rejectionReason || null
          },
          ipAddress: req.ip
        }
      );
    }

    res.json({
      success: true,
      message: 'Verification status updated successfully',
      data: verification
    });
  } catch (error) {
    console.error('========================================');
    console.error('❌ ERROR UPDATING VERIFICATION STATUS');
    console.error('========================================');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================');
    
    res.status(500).json({
      success: false,
      message: 'Failed to update verification status',
      error: error.message
    });
  }
};

const getVerificationStats = async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: {
        total,
        pending: statusCounts.pending || 0,
        approved: statusCounts.approved || 0,
        rejected: statusCounts.rejected || 0,
        under_review: statusCounts.under_review || 0
      }
    });
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verification stats',
      error: error.message
    });
  }
};

const getUserImages = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'UserId is required'
      });
    }

    const verifications = await CredentialVerification.find({ userId })
      .sort({ submittedAt: -1 })
      .limit(1)
      .lean();

    if (!verifications || verifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No verifications found for this user'
      });
    }

    const verification = verifications[0];
    const images = {
      faceVerification: verification.faceVerification,
      validId: verification.validId,
      credentials: verification.credentials
    };

    res.json({
      success: true,
      data: {
        userId,
        images
      }
    });
  } catch (error) {
    console.error('Error fetching user images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user images',
      error: error.message
    });
  }
};

module.exports = {
  getAllVerifications,
  getVerificationById,
  updateVerificationStatus,
  getVerificationStats,
  getUserImages
};
