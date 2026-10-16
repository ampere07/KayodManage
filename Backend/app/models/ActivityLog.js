const mongoose = require('mongoose');
const { AUDIT_ACTION_TYPES, AUDIT_TARGET_TYPES, AUDIT_TARGET_MODELS } = require('../constants/auditActions');

const activityLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actionType: {
    type: String,
    // Built from constants/auditActions.js — the one place a logged action is
    // declared. A value missing there is rejected here, and because both write
    // helpers swallow the error and return null, the audit row is silently
    // dropped while the admin action itself still succeeds.
    enum: AUDIT_ACTION_TYPES,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  targetType: {
    type: String,
    enum: AUDIT_TARGET_TYPES,
    required: false
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'targetModel',
    required: false
  },
  targetModel: {
    type: String,
    enum: AUDIT_TARGET_MODELS,
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    required: false
  },
  // The browser the action came from, for the entry's "from" line.
  userAgent: {
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
