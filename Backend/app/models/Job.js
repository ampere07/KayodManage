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
  category: {
    type: String,
    required: true,
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
  location: {
    type: Schema.Types.Mixed,
    required: true
  },
  locationDetails: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true
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
    enum: ['wallet', 'cash', 'xendit'],
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed', 'cancelled'],
    default: 'open'
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  budget: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
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
  paidAt: {
    type: Date,
    default: null
  },
  draftId: {
    type: String,
    default: null
  },
  completionStatus: {
    type: Schema.Types.Mixed,
    default: {}
  },
  // Soft deletion fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deletionReason: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
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
JobSchema.index({ category: 1 });
JobSchema.index({ user: 1 });
JobSchema.index({ assignedTo: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ date: 1 });
JobSchema.index({ isUrgent: 1 });
JobSchema.index({ isDeleted: 1 });
JobSchema.index({ deletedAt: -1 });
JobSchema.index({ title: 'text', description: 'text' });

// Instance method for soft deletion
JobSchema.methods.softDelete = function(deletedBy, reason = 'Deleted due to policy violation') {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deletionReason = reason;
  this.status = 'cancelled';
  return this.save();
};

// Instance method to restore deleted job
JobSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  this.deletionReason = null;
  this.status = 'open'; // or previous status
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