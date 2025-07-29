const mongoose = require('mongoose');
const { Schema } = mongoose;

const FeeRecordSchema = new Schema({
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'waived', 'cancelled'],
    default: 'pending'
  },
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'cash', 'xendit', 'bank_transfer'],
    default: 'wallet'
  },
  transaction: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  isFirstOffense: {
    type: Boolean,
    default: false
  },
  penaltyApplied: {
    type: Boolean,
    default: false
  },
  remindersSent: {
    type: Number,
    default: 0
  },
  lastReminderSent: {
    type: Date
  },
  dueDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to check if fee is paid
FeeRecordSchema.virtual('isPaid').get(function() {
  return this.status === 'paid';
});

// Virtual to check if fee is overdue
FeeRecordSchema.virtual('isOverdue').get(function() {
  return this.status !== 'paid' && new Date() > this.dueDate;
});

// Indexes for better query performance
FeeRecordSchema.index({ provider: 1 });
FeeRecordSchema.index({ job: 1 });
FeeRecordSchema.index({ status: 1 });
FeeRecordSchema.index({ dueDate: 1 });
FeeRecordSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FeeRecord', FeeRecordSchema, 'feerecords');