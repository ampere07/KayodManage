const mongoose = require('mongoose');
const { Schema } = mongoose;

const jobDetailsSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  category: { type: String },
  icon: { type: String },
  media: [{ type: String }],
  video: {
    uri: String,
    cloudinaryUrl: String,
    publicId: String,
    originalName: String,
    duration: Number,
    format: String,
    size: Number,
    type: { type: String, default: "video" },
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
    name: String,
    city: String,
    region: String,
    country: { type: String, default: "Philippines" },
  },
  locationDetails: { type: String, default: "" },
  date: { type: Date },
  isUrgent: { type: Boolean, default: false },
  serviceTier: { type: String, default: "standard" },
  paymentMethod: { type: String, default: "wallet" },
  status: { type: String },
  softLimitBudget: { type: Number, default: 0 },
  budget: { type: Number, default: 0 },
  budgetType: { type: String, default: "fixed" },
  createdAt: { type: Date },
  updatedAt: { type: Date },
}, { _id: false });

const ReportedPostSchema = new Schema({
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  jobDetails: {
    type: jobDetailsSchema,
    required: true
  },
  reportedByDetails: {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    providerName: {
      type: String,
      required: true
    },
    providerEmail: {
      type: String,
      required: true
    },
    providerUserType: {
      type: String,
      required: true
    },
    reportedAt: {
      type: Date,
      required: true
    },
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
  reportedUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'spam',
      'inappropriate_content',
      'fake_job',
      'misleading_information',
      'harassment',
      'unfinished_work',
      'substandard_work',
      'discrimination',
      'scam',
      'unsafe_work_conditions',
      'payment_issues',
      'other'
    ],
    trim: true
  },
  comment: {
    type: String,
    default: "",
    maxlength: 1000,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  adminNotes: {
    type: String,
    maxlength: 1000,
    default: ""
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ReportedPostSchema.index({ jobId: 1, reportedBy: 1 }, { unique: true });

// Populate job details when querying
ReportedPostSchema.virtual('jobPosterDetails', {
  ref: 'User',
  localField: 'jobPosterId',
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

module.exports = mongoose.models.ReportedPost || mongoose.model("ReportedPost", ReportedPostSchema);