const mongoose = require('mongoose');

const {
  REPORT_REASONS,
  REPORT_STATUSES,
  OPEN_REPORT_STATUSES,
  ACTIONS_TAKEN,
} = require('../constants/reportTaxonomy');

const reportSchema = new mongoose.Schema({
  // Type of report (job, user, message, conversation, review, payment, other)
  reportType: {
    type: String,
    required: true,
    enum: ["job", "user", "message", "conversation", "review", "payment", "other"],
    index: true
  },
  
  // ID of the person being reported
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function() {
      return ["user", "message", "conversation"].includes(this.reportType);
    }
  },
  
  // ID of the related item (jobId, messageId, conversationId, etc.)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // The job this report arose from, when there is one. For reportType "user"
  // (a client reporting the provider who worked their job) relatedId holds the
  // reported USER, so without this the report was not attached to a job at all:
  // the unique index below let a client report a given provider exactly once
  // ever, across every job they ever booked them for, and per-job report state
  // could not be answered at all.
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    default: null,
    index: true
  },
  
  // Who made the report
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  
  // Reason for the report
  reason: {
    type: String,
    required: true,
    // Canonical vocabulary — see src/constants/reportTaxonomy.js. Previously an
    // inline list that duplicated "fraud" and disagreed with ReportedPost's
    // list on the same concepts.
    enum: REPORT_REASONS,
    index: true
  },
  
  // Additional comments
  comment: {
    type: String,
    default: "",
    maxlength: 1000,
    trim: true
  },
  
  // Report status
  status: {
    type: String,
    enum: REPORT_STATUSES,
    default: "open",
    index: true
  },
  
  // Admin who reviewed the report
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  
  // When the report was reviewed
  reviewedAt: {
    type: Date,
    default: null
  },
  
  // Admin notes
  adminNotes: {
    type: String,
    maxlength: 2000,
    default: ""
  },
  
  // Action taken on the report
  actionTaken: {
    type: String,
    enum: ACTIONS_TAKEN,
    default: "none"
  },
  
  // Metadata for tracking
  reportMetadata: {
    reporterIP: String,
    reporterUserAgent: String,
    reportSource: {
      type: String,
      enum: ["web", "mobile", "api"],
      default: "web"
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
// One report per reporter per target PER JOB. jobId is part of the key so a
// client can report the same provider on a later booking; it indexes as null for
// reports with no job (messages, reviews, payments), which keeps those unique
// per target exactly as before.
reportSchema.index({ reportType: 1, relatedId: 1, reportedBy: 1, jobId: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportType: 1, status: 1 });
reportSchema.index({ reportedUserId: 1, status: 1 });

// Pre-save middleware
reportSchema.pre("save", function(next) {
  if (this.isModified("status") && this.status !== "open" && !this.reviewedAt) {
    this.reviewedAt = new Date();
  }
  next();
});

// Static methods
reportSchema.statics.findByType = function(reportType, status = null) {
  const query = { reportType };
  if (status) query.status = status;
  
  return this.find(query)
    .populate("reportedBy", "name email userType")
    .populate("reportedUserId", "name email userType")
    .populate("reviewedBy", "name email userType")
    .sort({ createdAt: -1 });
};

reportSchema.statics.hasUserReported = async function(reportType, relatedId, userId) {
  const report = await this.findOne({ reportType, relatedId, reportedBy: userId });
  return !!report;
};

reportSchema.statics.getReportStats = async function(reportType = null) {
  const matchStage = reportType ? { reportType } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = REPORT_STATUSES.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    { total: 0 }
  );
  
  stats.forEach(item => {
    result[item._id] = item.count;
    result.total += item.count;
  });
  
  // Everything still awaiting an admin, in one number for the queue badge.
  result.open_total = OPEN_REPORT_STATUSES.reduce(
    (sum, status) => sum + (result[status] || 0),
    0
  );
  
  return result;
};

module.exports = mongoose.model("Report", reportSchema);
