const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReportedPostSchema = new Schema({
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  reportedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobPosterId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'inappropriate_content',
      'spam',
      'scam_or_fraud',
      'misleading_information',
      'copyright_violation',
      'discrimination',
      'harassment',
      'violence_or_threats',
      'adult_content',
      'fake_job_posting',
      'duplicate_posting',
      'other'
    ],
    trim: true
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Admin user
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  actionTaken: {
    type: String,
    enum: ['none', 'post_deleted', 'post_approved', 'user_warned', 'user_restricted', 'report_dismissed'],
    default: 'none'
  },
  // Additional metadata for tracking
  reportMetadata: {
    reporterIP: String,
    reporterUserAgent: String,
    reportSource: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Populate job details when querying
ReportedPostSchema.virtual('jobDetails', {
  ref: 'Job',
  localField: 'jobId',
  foreignField: '_id',
  justOne: true
});

// Populate reporter details
ReportedPostSchema.virtual('reporterDetails', {
  ref: 'User',
  localField: 'reportedBy',
  foreignField: '_id',
  justOne: true
});

// Populate job poster details
ReportedPostSchema.virtual('jobPosterDetails', {
  ref: 'User',
  localField: 'jobPosterId',
  foreignField: '_id',
  justOne: true
});

// Populate reviewer details
ReportedPostSchema.virtual('reviewerDetails', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true
});

// Indexes for better query performance
ReportedPostSchema.index({ status: 1 });
ReportedPostSchema.index({ jobId: 1 });
ReportedPostSchema.index({ reportedBy: 1 });
ReportedPostSchema.index({ jobPosterId: 1 });
ReportedPostSchema.index({ createdAt: -1 });
ReportedPostSchema.index({ reviewedAt: -1 });
ReportedPostSchema.index({ reason: 1 });

// Compound indexes for common queries
ReportedPostSchema.index({ status: 1, createdAt: -1 });
ReportedPostSchema.index({ jobId: 1, status: 1 });

// Prevent duplicate reports from same user for same job
ReportedPostSchema.index({ jobId: 1, reportedBy: 1 }, { unique: true });

// Pre-save middleware to set reviewedAt when status changes to reviewed
ReportedPostSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending' && !this.reviewedAt) {
    this.reviewedAt = new Date();
  }
  next();
});

// Static method to get reports summary
ReportedPostSchema.statics.getReportsSummary = async function() {
  const summary = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    pending: 0,
    reviewed: 0,
    resolved: 0,
    dismissed: 0
  };
  
  summary.forEach(item => {
    result[item._id] = item.count;
    result.total += item.count;
  });
  
  return result;
};

// Instance method to mark as reviewed
ReportedPostSchema.methods.markAsReviewed = function(adminId, notes = '') {
  this.status = 'reviewed';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.adminNotes = notes;
  return this.save();
};

module.exports = mongoose.model('ReportedPost', ReportedPostSchema);