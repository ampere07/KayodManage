const mongoose = require('mongoose');
const { Schema } = mongoose;

const TransactionSchema = new Schema({
  type: {
    type: String,
    enum: ['payment', 'top_up', 'fee_payment', 'refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'Job'
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'cash', 'xendit'],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  xenditId: {
    type: String,
    trim: true
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ userId: 1 });
TransactionSchema.index({ jobId: 1 });
TransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);