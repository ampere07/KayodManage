const mongoose = require('mongoose');
const { Schema } = mongoose;

const AlertSchema = new Schema({
  type: {
    type: String,
    enum: ['critical', 'warning', 'info'],
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
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
AlertSchema.index({ type: 1 });
AlertSchema.index({ isRead: 1 });
AlertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);