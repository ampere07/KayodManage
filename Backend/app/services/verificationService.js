const mongoose = require('mongoose');
const CredentialVerification = require('../models/CredentialVerification');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary once (expects env vars)
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const sanitizeName = (value = '') => value.replace(/[^a-zA-Z0-9]/g, '');

const getUserFolder = (user) => {
  const parts = (user?.name || '').trim().split(/\s+/).filter(Boolean);
  let first = 'User';
  let last = '';
  if (parts.length >= 2) {
    first = sanitizeName(parts[0]);
    last = sanitizeName(parts[parts.length - 1]);
  } else if (parts.length === 1) {
    first = sanitizeName(parts[0]);
  }
  return last ? `${first}_${last}` : first;
};

const mapCloudinaryAssetsToDocuments = (resources = []) => {
  const faceVerification = [];
  const validId = [];
  const credentials = [];

  resources.forEach((res, idx) => {
    const doc = {
      cloudinaryUrl: res.secure_url,
      publicId: res.public_id,
      uploadedAt: res.created_at
    };

    const basename = res.public_id.split('/').pop() || '';

    if (basename.startsWith('face_')) {
      faceVerification.push(doc);
      return;
    }

    if (basename.startsWith('frontID_')) {
      validId[0] = { ...doc, type: 'front' };
      return;
    }

    if (basename.startsWith('backID_')) {
      validId[1] = { ...doc, type: 'back' };
      return;
    }

    // Anything else treat as credential
    credentials.push(doc);
  });

  // If no prefix matches, map first items by position for usability
  if (faceVerification.length === 0 && resources.length > 0) {
    faceVerification.push({
      cloudinaryUrl: resources[0].secure_url,
      publicId: resources[0].public_id,
      uploadedAt: resources[0].created_at
    });
  }

  // If only one face image, position it as the center (front) slot
  if (faceVerification.length === 1) {
    faceVerification.splice(0, 0, null);
    faceVerification.push(null);
  }

  if (validId.length === 0 && resources.length > 1) {
    validId[0] = {
      cloudinaryUrl: resources[resources.length > 2 ? 1 : 1].secure_url,
      publicId: resources[resources.length > 2 ? 1 : 1].public_id,
      uploadedAt: resources[resources.length > 2 ? 1 : 1].created_at,
      type: 'front'
    };
  }

  if (validId.length <= 1 && resources.length > 2) {
    validId[1] = {
      cloudinaryUrl: resources[2].secure_url,
      publicId: resources[2].public_id,
      uploadedAt: resources[2].created_at,
      type: 'back'
    };
  }

  // Remaining go to credentials
  if (resources.length > 3 && credentials.length === 0) {
    resources.slice(3).forEach((res) => {
      credentials.push({
        cloudinaryUrl: res.secure_url,
        publicId: res.public_id,
        uploadedAt: res.created_at
      });
    });
  }

  return {
    faceVerification,
    validId,
    credentials
  };
};

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

    // Get all verifications with basic populate
    const verifications = await CredentialVerification.find(query)
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .lean();

    // Group by user and count attempts
    const userAttempts = {};
    verifications.forEach(v => {
      const userId = v.userId?._id?.toString() || v.userId?.toString();
      if (userId) {
        userAttempts[userId] = (userAttempts[userId] || 0) + 1;
      }
    });

    // Add verificationAttempts to each verification
    const verificationsWithAttempts = verifications.map(v => {
      const userId = v.userId?._id?.toString() || v.userId?.toString();
      return {
        ...v,
        verificationAttempts: userAttempts[userId] || 1
      };
    });

    // Apply pagination after processing
    const paginatedResults = verificationsWithAttempts
      .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    return paginatedResults;
  }

  /**
   * Get a single verification by ID
   */
  async getVerificationById(verificationId) {
    // Get the specific verification
    const verification = await CredentialVerification.findById(verificationId)
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email')
      .lean();

    if (!verification) {
      return null;
    }

    // Count all verifications for this user
    const totalAttempts = await CredentialVerification.countDocuments({
      userId: verification.userId
    });

    // Add verificationAttempts to the result
    return {
      ...verification,
      verificationAttempts: totalAttempts || 1
    };
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
    // Get the latest verification for this user
    const verification = await CredentialVerification.findOne({ userId })
      .populate('userId', 'name email userType profileImage createdAt')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .lean();

    if (!verification) {
      return null;
    }

    // Count all verifications for this user
    const totalAttempts = await CredentialVerification.countDocuments({ userId });

    // Add verificationAttempts to the result
    return {
      ...verification,
      verificationAttempts: totalAttempts || 1
    };
  }

  /**
   * Get user images from latest verification
   */
  async getUserImages(userId, attemptNumber) {
    // Prefer Cloudinary folder listing when configured; fallback to DB
    const attemptNum = attemptNumber || null;

    // Load all attempts for timestamps and DB fallback
    const verifications = await CredentialVerification.find({ userId })
      .sort({ submittedAt: 1 })
      .lean();

    if (!verifications || verifications.length === 0) {
      return null;
    }

    const attemptTimestamps = verifications.map((v, idx) => {
      const submittedAtFromAttempts = Array.isArray(v.attempts) && v.attempts.length > 0
        ? v.attempts.find((a) => a.attemptNumber === idx + 1)?.submittedAt
        : null;
      return {
        attempt: idx + 1,
        submittedAt: submittedAtFromAttempts || v.submittedAt || v.createdAt
      };
    });

    const attemptIndex = attemptNum
      ? Math.max(0, Math.min(verifications.length - 1, attemptNum - 1))
      : verifications.length - 1;
    const attemptSubmittedAt = attemptTimestamps[attemptIndex]?.submittedAt || null;
    // Use the requested attempt number if provided; otherwise fall back to the index-derived attempt
    const attemptSuffix = attemptNum || (attemptTimestamps[attemptIndex]?.attempt ?? attemptIndex + 1);

    // Try Cloudinary if credentials exist
    if (cloudinary.config()?.cloud_name) {
      const user = await User.findById(userId).lean();
      if (user) {
        const folder = getUserFolder(user);
        const prefix = `verificationUpload/${folder}/Attempt${attemptSuffix}`;

        try {
          console.log('[VerificationImages] Fetching from Cloudinary', {
            userId,
            userName: user.name,
            attempt: attemptSuffix,
            prefix
          });
          const { resources } = await cloudinary.search
            .expression(`folder:${prefix}`)
            .sort_by('public_id', 'asc')
            .max_results(100)
            .execute();

          if (resources && resources.length > 0) {
            console.log('[VerificationImages] Cloudinary resources found', resources.length, resources.map((r) => r.public_id));
            return {
              userId,
              attemptNumber: attemptSuffix,
              attemptSubmittedAt,
              attemptTimestamps,
              images: mapCloudinaryAssetsToDocuments(resources)
            };
          }
          console.log('[VerificationImages] No Cloudinary resources found, falling back to DB');
        } catch (err) {
          console.error('Cloudinary fetch failed, falling back to DB:', err.message);
        }
      }
    }

    // Fallback: fetch stored verification documents
    console.log('[VerificationImages] Using DB fallback for user', { userId, attempt: attemptNum });

    const verification = verifications[attemptIndex];

    return {
      userId,
      attemptNumber: attemptIndex + 1,
      attemptSubmittedAt,
      attemptTimestamps,
      images: {
        faceVerification: verification.faceVerification,
        validId: verification.validId,
        credentials: verification.credentials
      }
    };
  }
}

module.exports = new VerificationService();
