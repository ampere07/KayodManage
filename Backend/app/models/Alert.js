const mongoose = require('mongoose');
const { Schema } = mongoose;

const AlertSchema = new Schema({
  type: {
    type: String,
    enum: ['critical', 'warning', 'info'],
    required: true
  },
  category: {
    type: String,
    enum: ['reported_post', 'verification_request', 'support_ticket', 'system', 'user_activity', 'transaction'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'Job'
  },
  transactionId: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  reportId: {
    type: Schema.Types.ObjectId,
    ref: 'ReportedPost'
  },
  verificationId: {
    type: Schema.Types.ObjectId,
    ref: 'CredentialVerification'
  },
  supportId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatSupport'
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  actionUrl: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
AlertSchema.index({ type: 1 });
AlertSchema.index({ category: 1 });
AlertSchema.index({ isActive: 1 });
AlertSchema.index({ isRead: 1 });
AlertSchema.index({ priority: -1 });
AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ isActive: 1, priority: -1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);