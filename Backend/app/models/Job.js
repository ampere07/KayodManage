const mongoose = require('mongoose');
const { Schema } = mongoose;

const JobSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  // profession/categoryId were never real fields — kayod/server's actual Job
  // schema (the app that writes every real job) only has professionName
  // (String, no default requirement) and category (String). Marking these
  // required here made KayodManage's own job.save() calls (forceCancelJob,
  // resolveDispute) fail full-document validation on any real job, since
  // real documents never had them in the first place.
  profession: {
    type: Schema.Types.ObjectId,
    required: false
  },
  professionName: {
    type: String,
    required: false,
    default: null,
    trim: true
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'JobCategory',
    required: false
  },
  categoryName: {
    type: String,
    required: false,
    trim: true
  },
  // The real field kayod/server actually writes (String, required there).
  category: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    trim: true
  },
  media: [{
    type: String,
    trim: true
  }],
  video: {
    type: String,
    default: null
  },
  location: {
    type: Schema.Types.Mixed,
    required: false
  },
  locationDetails: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: false
  },
  selectedDates: {
    type: [Date],
    default: []
  },
  timeWindows: {
    type: [String],
    default: []
  },
  dateDetails: {
    type: Schema.Types.Mixed,
    default: null
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  serviceTier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: 'standard'
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'xendit'],
    required: true,
    default: 'wallet'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'scheduled', 'completed', 'cancelled'],
    default: 'open'
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedToId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  softLimitBudget: {
    type: Number,
    default: 0,
    min: 0
  },
  budget: {
    type: Number,
    default: 0,
    min: 0
  },
  budgetType: {
    type: String,
    enum: ['fixed', 'flexible'],
    default: 'fixed'
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['wallet', 'xendit'],
      default: 'wallet'
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    paidAt: {
      type: Date,
      default: null
    },

    feeStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'paid', 'waived'],
      default: 'not_applicable'
    },
    feeRecord: {
      type: Schema.Types.ObjectId,
      ref: 'FeeRecord',
      default: null
    },
    heldTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    }
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'escrow_required', 'escrow_held', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  escrowAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  draftId: {
    type: String,
    default: null
  },
  completionStatus: {
    clientConfirmed: {
      type: Boolean,
      default: false
    },
    providerConfirmed: {
      type: Boolean,
      default: false
    },
    paymentReleased: {
      type: Boolean,
      default: false
    },
    providerConfirmedAt: {
      type: Date,
      default: null
    },
    clientConfirmedAt: {
      type: Date,
      default: null
    },
    paymentReleasedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    dispute: {
      isActive: { type: Boolean, default: false },
      raisedBy: { type: String, enum: ['client', 'provider'], default: null },
      raisedAt: { type: Date, default: null },
      reason: { type: String, default: null },
      resolvedAt: { type: Date, default: null },
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      resolution: { type: String, enum: ['provider_paid', 'client_refunded', 'rebook', null], default: null },
      escalatedAt: { type: Date, default: null },
      internalNotes: [{
        adminId: { type: Schema.Types.ObjectId, ref: 'User' },
        adminName: String,
        note: String,
        createdAt: { type: Date, default: Date.now }
      }]
    },
    disputeHistory: [{
      raisedBy: { type: String, enum: ['client', 'provider'] },
      raisedAt: Date,
      reason: String,
      resolvedAt: Date,
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      resolution: { type: String, enum: ['provider_paid', 'client_refunded', 'rebook'] }
    }]
  },
  cancellation: {
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: null },
    feeApplied: { type: Number, default: null }
  },
  escrowAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  escrowReleaseAt: {
    type: Date,
    default: null
  },
  escrowStatus: {
    type: String,
    enum: ['none', 'pending', 'releasing', 'released', 'refunded', 'failed'],
    default: 'none'
  },
  escrowScheduledAt: {
    type: Date,
    default: null
  },
  acceptedProvider: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  agreedPrice: {
    type: Number,
    default: null
  },
  hasNewQuotes: {
    type: Boolean,
    default: false
  },
  lastQuoteAt: {
    type: Date,
    default: null
  },
  startNavigation: {
    // Mirrors kayod/server's tri-state field: false (idle), true (en route),
    // and "arrived". Admin dispute resolution saves the shared Job document,
    // so this schema must accept the app's arrival value without casting it.
    type: Schema.Types.Mixed,
    default: false
  },
  navigationStartedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletionReason: {
    type: String,
    trim: true,
    default: null
  },
  archived: {
    type: Boolean,
    default: false
  },
  archiveType: {
    type: String,
    enum: ['hidden', 'removed'],
    default: null
  },
  archivedAt: {
    type: Date,
    default: null
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  hiddenAt: {
    type: Date,
    default: null
  },
  hiddenBy: {
    type: String,
    default: null
  },
  deletedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for backward compatibility - map userId to user
JobSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for backward compatibility - map assignedToId to assignedTo
JobSchema.virtual('assignedTo', {
  ref: 'User',
  localField: 'assignedToId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get application count
JobSchema.virtual('applicationCount', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'job',
  count: true
});

// Virtual to get applications
JobSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'job'
});

// Indexes for better query performance
JobSchema.index({ status: 1 });
JobSchema.index({ profession: 1 });
JobSchema.index({ professionName: 1 });
JobSchema.index({ categoryId: 1 });
JobSchema.index({ categoryName: 1 });
JobSchema.index({ userId: 1 });
JobSchema.index({ assignedToId: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ date: 1 });
JobSchema.index({ isUrgent: 1 });
JobSchema.index({ isDeleted: 1 });
JobSchema.index({ archived: 1 });
JobSchema.index({ isHidden: 1 });
JobSchema.index({ archiveType: 1 });
JobSchema.index({ deletedAt: -1 });
JobSchema.index({ title: 'text', description: 'text' });

// Instance method for soft deletion
JobSchema.methods.softDelete = function(deletedBy, reason = 'Deleted due to policy violation') {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletionReason = reason;
  this.status = 'cancelled';
  return this.save();
};

// Instance method to restore deleted job
JobSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletionReason = null;
  this.status = 'open';
  return this.save();
};

// Static method to find active jobs (not deleted)
JobSchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, isDeleted: false });
};

// Static method to find deleted jobs
JobSchema.statics.findDeleted = function(conditions = {}) {
  return this.find({ ...conditions, isDeleted: true });
};

// Static method to find all jobs including deleted (for admin purposes)
JobSchema.statics.findAll = function(conditions = {}) {
  return this.find(conditions);
};

module.exports = mongoose.model('Job', JobSchema, 'jobs');
