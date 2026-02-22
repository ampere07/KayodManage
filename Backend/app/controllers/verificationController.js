const verificationService = require('../services/verificationService');
const { logActivity } = require('../utils/activityLogger');

const getAllVerifications = async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;

    const verifications = await verificationService.getAllVerifications({
      status,
      limit,
      skip
    });

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

    const verification = await verificationService.getVerificationById(verificationId);

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
    const { status, adminNotes, rejectionReason, banUser } = req.body;

    console.log('----------------------------------------');
    console.log('📦 UPDATE VERIFICATION STATUS REQUEST');
    console.log('ID:', verificationId);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('User ID:', req.user?.id);
    console.log('----------------------------------------');

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
      console.error('❌ Invalid ObjectId:', verificationId);
      return res.status(400).json({
        success: false,
        message: 'Invalid verification ID format'
      });
    }

    const verification = await verificationService.updateVerificationStatus(
      verificationId,
      { status, adminNotes, rejectionReason, banUser },
      req.user?.id
    );

    console.log('✅ Verification status updated successfully');

    if (status === 'approved' || status === 'rejected') {
      const actionType = status === 'approved' ? 'verification_approved' : 'verification_rejected';
      const description = status === 'approved'
        ? `Approved verification for ${verification.userId.name}`
        : `Rejected verification for ${verification.userId.name}`;

      const targetUserId = verification.userId?._id || verification.userId;

      await logActivity(
        req.user.id,
        actionType,
        description,
        {
          targetType: 'verification',
          targetId: targetUserId,
          targetModel: 'User',
          metadata: {
            verificationId: verification._id,
            rejectionReason: rejectionReason || null
          },
          ipAddress: req.ip
        }
      );
    }

    // Emit socket event for user update
    try {
      const targetUserIdForSocket = verification.userId?._id || verification.userId;
      if (targetUserIdForSocket) {
        const userService = require('../services/userService');
        const userWithData = await userService.getUserById(targetUserIdForSocket);

        if (userWithData) {
          const { io } = require('../../server');

          // Target the admin namespace specifically
          const adminNamespace = io.of('/admin');
          adminNamespace.to('admin').emit('user:updated', {
            user: userWithData,
            updateType: status === 'approved' ? 'verified' : 'unverified',
            timestamp: new Date()
          });

          console.log(`📡 Emitted user:updated for ${userWithData.name} to admin namespace`);
        }
      }
    } catch (socketError) {
      console.error('Error emitting user update socket:', socketError);
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

    let statusCode = 500;
    if (error.name === 'ValidationError' || error.name === 'CastError' || error.message.includes('Invalid') || error.message.includes('required')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
      details: error.errors || null
    });
  }
};

const getVerificationStats = async (req, res) => {
  try {
    const stats = await verificationService.getVerificationStats();

    res.json({
      success: true,
      data: stats
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

    const data = await verificationService.getUserImages(userId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'No verifications found for this user'
      });
    }

    res.json({
      success: true,
      data
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

const getVerificationByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const verification = await verificationService.getVerificationByUserId(userId);

    res.json({
      success: true,
      data: verification || null
    });
  } catch (error) {
    console.error('Error fetching user verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user verification details',
      error: error.message
    });
  }
};

module.exports = {
  getAllVerifications,
  getVerificationById,
  getVerificationByUserId,
  updateVerificationStatus,
  getVerificationStats,
  getUserImages
};
