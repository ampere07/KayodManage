const verificationService = require('../services/verificationService');
const { logActivity } = require('../utils/activityLogger');
const { getIO } = require('../realtime/ioRegistry');
const { logger } = require('../utils/logger');

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
    logger.error('Error fetching verifications', { err: error });
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
    logger.error('Error fetching verification', { err: error });
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

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
      logger.warn('Verification status update rejected: invalid id', { verificationId: String(verificationId) });
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

    logger.info('Verification status updated', { verificationId, status });

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
          const io = getIO();

          // Target the admin namespace specifically
          const adminNamespace = io.of('/admin');
          adminNamespace.to('admin').emit('user:updated', {
            user: userWithData,
            updateType: status === 'approved' ? 'verified' : 'unverified',
            timestamp: new Date()
          });
        }
      }
    } catch (socketError) {
      logger.error('Error emitting user update socket', { err: socketError });
    }

    res.json({
      success: true,
      message: 'Verification status updated successfully',
      data: verification
    });
  } catch (error) {
    logger.error('Failed to update verification status', { verificationId: req.params.verificationId, err: error });

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
    logger.error('Error fetching verification stats', { err: error });
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
    const attemptNumber = req.query.attempt ? parseInt(req.query.attempt, 10) : undefined;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'UserId is required'
      });
    }

    const data = await verificationService.getUserImages(userId, attemptNumber);

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
    logger.error('Error fetching user images', { err: error });
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
    logger.error('Error fetching user verification', { err: error });
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
