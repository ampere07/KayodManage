const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actionType: {
    type: String,
    enum: [
      'verification_approved',
      'verification_rejected',
      'user_restricted',
      'user_suspended',
      'user_banned',
      'user_unrestricted',
      'transaction_completed',
      'transaction_failed',
      'support_closed',
      'support_reopened',
      'admin_login',
      'job_hidden',
      'job_unhidden'
    ],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  targetType: {
    type: String,
    enum: ['user', 'transaction', 'support', 'verification', 'job'],
    required: false
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'targetModel',
    required: false
  },
  targetModel: {
    type: String,
    enum: ['User', 'Transaction', 'ChatSupport', 'CredentialVerification', 'Job'],
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

activityLogSchema.index({ adminId: 1, createdAt: -1 });
activityLogSchema.index({ actionType: 1, createdAt: -1 });
activityLogSchema.index({ targetId: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
