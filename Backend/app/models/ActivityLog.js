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
      'user_deleted',
      'user_unrestricted',
      'transaction_completed',
      'transaction_failed',
      'support_closed',
      'support_reopened',
      'admin_login',
      'job_hidden',
      'job_unhidden',
      'job_deleted',
      'job_restored',
      // Both of these ARE logged by jobController (resolveDispute and
      // forceCancelJob) but were missing from this enum, so every write failed
      // validation. createActivityLog swallows its errors, so the two admin
      // actions that move the most money were the two that left no audit trail.
      'dispute_resolved',
      'job_force_cancelled',
      // Logged by supportController when an admin takes ownership of a ticket.
      // Same omission as the two above: createActivityLog swallows its own
      // errors, so a missing value here silently loses the audit trail rather
      // than failing the action. Any new logActivity/createActivityLog call
      // MUST add its verb to this list — it is the audit trail, not decoration.
      'support_accepted',
      // Bulk transaction approval (routes/transactions.js). Found by the enum
      // coverage guard on its first run — a bulk money approval that had been
      // leaving no audit entry at all.
      'bulk_transaction_approval'
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
