const mongoose = require('mongoose');
const { Schema } = mongoose;

const ActivityFeedSchema = new Schema({
  type: {
    type: String,
    enum: ['user_registered', 'user_login', 'job_posted', 'job_applied', 'job_completed', 'payment_completed', 'fee_paid'],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
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
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
ActivityFeedSchema.index({ type: 1 });
ActivityFeedSchema.index({ createdAt: -1 });
ActivityFeedSchema.index({ userId: 1 });

module.exports = mongoose.model('ActivityFeed', ActivityFeedSchema);