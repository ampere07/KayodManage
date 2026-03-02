const mongoose = require('mongoose');

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
    enum: [
      // Job reasons
      "spam",
      "inappropriate_content",
      "scam_or_fraud",
      "misleading_information",
      "copyright_violation",
      "discrimination",
      "harassment",
      "violence_or_threats",
      "adult_content",
      "fake_job_posting",
      "duplicate_posting",
      "unsafe_work_conditions",
      "payment_issues",
      "fake_job",
      // User reasons
      "fake_profile",
      "misconduct",
      // Message reasons
      "threats",
      "unsolicited_solicitation",
      // Conversation reasons
      "fraud",
      "inappropriate_behavior",
      // Review reasons
      "fake_review",
      "defamation",
      "conflict_of_interest",
      // Payment reasons
      "fraud",
      "unauthorized_charge",
      "payment_dispute",
      // General
      "other"
    ],
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
    enum: ["pending", "reviewed", "resolved", "dismissed"],
    default: "pending",
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
    enum: [
      "none",
      "post_deleted",
      "post_approved",
      "user_warned",
      "user_restricted",
      "user_suspended",
      "report_dismissed",
      "conversation_deleted",
      "message_deleted"
    ],
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
reportSchema.index({ reportType: 1, relatedId: 1, reportedBy: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportType: 1, status: 1 });
reportSchema.index({ reportedUserId: 1, status: 1 });

// Pre-save middleware
reportSchema.pre("save", function(next) {
  if (this.isModified("status") && this.status !== "pending" && !this.reviewedAt) {
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
  
  const result = {
    total: 0,
    pending: 0,
    reviewed: 0,
    resolved: 0,
    dismissed: 0
  };
  
  stats.forEach(item => {
    result[item._id] = item.count;
    result.total += item.count;
  });
  
  return result;
};

module.exports = mongoose.model("Report", reportSchema);
