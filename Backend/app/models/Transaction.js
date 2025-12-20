const mongoose = require('mongoose');
const { Schema } = mongoose;

const TransactionSchema = new Schema({
  fromUser: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  fromUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  toUser: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  toUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: [
      'immediate_payment', 
      'escrow_payment', 
      'escrow_release', 
      'wallet_topup', 
      'fee_payment', 
      'refund', 
      'platform_fee',
      'withdrawal',
      'xendit_topup',
      'cash_fee_payment'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'Job'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  platformFee: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'PHP'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  complianceChecked: {
    type: Boolean,
    default: false
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  retryCount: {
    type: Number,
    default: 0
  },
  xenditWebhookEvents: [{
    type: Schema.Types.Mixed
  }],
  xenditId: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'cash', 'xendit', 'bank_transfer'],
    default: 'wallet'
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  failureReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
TransactionSchema.index({ fromUser: 1 });
TransactionSchema.index({ fromUserId: 1 });
TransactionSchema.index({ toUser: 1 });
TransactionSchema.index({ toUserId: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ jobId: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ currency: 1 });
TransactionSchema.index({ completedAt: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema, 'transactions');