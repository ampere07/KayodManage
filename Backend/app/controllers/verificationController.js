const verificationService = require('../services/verificationService');
const Notification = require('../models/Notification');
const { logActivity } = require('../utils/activityLogger');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');

const getAllVerifications = async (req, res) => {
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
};

const getVerificationById = async (req, res) => {
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

    // Tell the provider what to fix. The rejection reason and the "what the user
    // needs to resubmit" note were stored only on the admin record — the app's
    // status endpoint (getPublicData) returns neither — so the provider never
    // saw them. The client already routes this type to its verification screen.
    // Best-effort: the review has been saved either way.
    const providerNotice = {
      rejected: verification.rejectionReason && {
        title: 'Verification Rejected',
        message: `Your credential verification was rejected: ${verification.rejectionReason}`,
      },
      resubmission_requested: verification.adminNotes && {
        title: 'Resubmission Requested',
        message: `Please resubmit your credential verification: ${verification.adminNotes}`,
      },
    }[verification.status];
    if (providerNotice) {
      try {
        await Notification.create({
          userId: verification.userId?._id || verification.userId,
          ...providerNotice,
          type: 'credential_verification',
          priority: 'high',
          data: { verificationId: String(verification._id), status: verification.status },
        });
      } catch (notifyError) {
        console.error('Error notifying provider of verification outcome:', notifyError);
      }
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
  const stats = await verificationService.getVerificationStats();

  res.json({
    success: true,
    data: stats
  });
};

const getUserImages = async (req, res) => {
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
};

const getVerificationByUserId = async (req, res) => {
  const { userId } = req.params;

  const verification = await verificationService.getVerificationByUserId(userId);

  res.json({
    success: true,
    data: verification || null
  });
};

module.exports = {
  getAllVerifications: asyncHandler(getAllVerifications, 'Failed to fetch verifications'),
  getVerificationById: asyncHandler(getVerificationById, 'Failed to fetch verification details'),
  getVerificationByUserId: asyncHandler(getVerificationByUserId, 'Failed to fetch user verification details'),
  updateVerificationStatus,
  getVerificationStats: asyncHandler(getVerificationStats, 'Failed to fetch verification stats'),
  getUserImages: asyncHandler(getUserImages, 'Failed to fetch user images'),
};
