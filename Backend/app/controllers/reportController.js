const mongoose = require("mongoose");
const Report = require("../models/Report");
const ReportedPost = require("../models/ReportedPost");
const User = require("../models/User");
const Job = require("../models/Job");
const { auditLog } = require("../utils/activityLogger");

// "action_taken" → "action taken", for audit descriptions.
const statusText = (status) => String(status || "").replace(/_/g, " ");

const {
  REPORT_STATUSES,
  OPEN_REPORT_STATUSES,
  LEGACY_STATUS_MAP,
  LEGACY_REASON_MAP,
} = require("../constants/reportTaxonomy");

// ---------------------------------------------------------------------------
// Legacy vocabulary normalization
//
// Both collections still hold documents written under the retired
// pending/reviewed/resolved statuses and the retired scam/fake_job reasons (see
// constants/reportTaxonomy.js). Rather than rewrite live documents, the combined
// admin feed maps them to the canonical vocabulary on read, so the admin UI only
// ever sees one set of words. Writes already go out canonical, so the stored
// data converges as reports get actioned.
// ---------------------------------------------------------------------------

const normalizeStatus = (status) =>
  LEGACY_STATUS_MAP[status] || (REPORT_STATUSES.includes(status) ? status : "open");

const normalizeReason = (reason) => LEGACY_REASON_MAP[reason] || reason || "other";

/**
 * Every raw value that normalizes to `canonical` — used to build the Mongo
 * query, since filtering on the canonical word alone would miss legacy rows.
 */
const rawValuesFor = (canonical, legacyMap) => [
  canonical,
  ...Object.keys(legacyMap).filter((legacy) => legacyMap[legacy] === canonical),
];

// Most accounts are phone-registered and have no email field at all, so the
// admin table falls back to the phone number as the secondary identifier.
const shapeUser = (user) =>
  user
    ? {
        _id: String(user._id),
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumberWithCountryCode || user.phoneNumber || "",
        userType: user.userType || "",
        // Lets the Flagged table show a banned/suspended account at a glance.
        accountStatus: user.accountStatus || "active",
      }
    : null;

/**
 * Admin: one feed over both report collections.
 *
 * `reports` (Report) and `reportedposts` (ReportedPost) are two generations of
 * the same idea and the admin Flagged page needs both. They are read separately,
 * normalized to a single shape carrying a `source` discriminator, then merged.
 * Referenced users and jobs are resolved with two batched $in lookups rather
 * than .populate(), because the legacy job-shaped documents sitting in `reports`
 * carry jobId/jobPosterId paths that the Report schema does not declare and
 * populate refuses to traverse.
 */
exports.getAllCombinedReports = async (req, res) => {
  try {
    const {
      status,
      reason,
      reportType,
      source,
      page = 1,
      limit = 500,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const reportQuery = {};
    const postQuery = {};
    if (status) {
      const raws = rawValuesFor(status, LEGACY_STATUS_MAP);
      reportQuery.status = { $in: raws };
      postQuery.status = { $in: raws };
    }
    if (reason) {
      const raws = rawValuesFor(reason, LEGACY_REASON_MAP);
      reportQuery.reason = { $in: raws };
      postQuery.reason = { $in: raws };
    }
    // Everything in ReportedPost is a report about a job posting.
    if (reportType) reportQuery.reportType = reportType;
    const wantReports = source !== "reported_post";
    const wantPosts =
      source !== "report" && (!reportType || reportType === "job");

    const [rawReports, rawPosts] = await Promise.all([
      wantReports ? Report.find(reportQuery).lean() : [],
      wantPosts ? ReportedPost.find(postQuery).lean() : [],
    ]);

    // Batch-resolve every referenced user and job in two queries.
    const userIds = new Set();
    const jobIds = new Set();
    const track = (set) => (id) => {
      if (id) set.add(String(id));
    };
    const trackUser = track(userIds);
    const trackJob = track(jobIds);

    for (const r of rawReports) {
      trackUser(r.reportedBy);
      trackUser(r.reportedUserId);
      trackUser(r.reviewedBy);
      trackUser(r.jobPosterId); // legacy job-shaped rows
      trackJob(r.jobId);
      trackJob(r.relatedId); // a "job" report points relatedId at the job
    }
    for (const p of rawPosts) {
      trackUser(p.reportedBy);
      trackUser(p.reportedUserId);
      trackUser(p.reviewedBy);
      trackUser(p.jobPosterId);
      trackJob(p.jobId);
    }

    const [users, jobs] = await Promise.all([
      userIds.size
        ? User.find({ _id: { $in: [...userIds] } })
            .select("name email phoneNumber phoneNumberWithCountryCode userType accountStatus")
            .lean()
        : [],
      jobIds.size
        ? Job.find({ _id: { $in: [...jobIds] } })
            .select(
              "title description category budget budgetType paymentMethod location media createdAt status isDeleted isHidden"
            )
            .lean()
        : [],
    ]);

    const userById = new Map(users.map((u) => [String(u._id), u]));
    const jobById = new Map(jobs.map((j) => [String(j._id), j]));
    const lookupUser = (id) => shapeUser(id ? userById.get(String(id)) : null);

    /** Live job document when we still have one, else the embedded snapshot. */
    const resolveJob = (jobId, snapshot) => {
      const live = jobId ? jobById.get(String(jobId)) : null;
      const src = live || snapshot;
      if (!src) return null;
      return {
        _id: String(live ? live._id : jobId || ""),
        title: src.title || "Untitled job",
        description: src.description || "",
        category: src.category || "",
        budget: src.budget || 0,
        budgetType: src.budgetType || "fixed",
        paymentMethod: src.paymentMethod || "Not specified",
        location: src.location || {},
        media: src.media || [],
        createdAt: src.createdAt,
        status: src.status,
        // A snapshot with no surviving job row means the job is gone.
        isDeleted: live ? Boolean(live.isDeleted) : Boolean(snapshot),
        isHidden: live ? Boolean(live.isHidden) : false,
      };
    };

    const fromReport = (r) => {
      // Legacy rows copied out of ReportedPost never got a reportType.
      const type = r.reportType || (r.jobId || r.jobDetails ? "job" : "other");
      const job = resolveJob(r.jobId || (type === "job" ? r.relatedId : null), r.jobDetails);
      return {
        _id: String(r._id),
        source: "report",
        reportType: type,
        reportedBy:
          lookupUser(r.reportedBy) ||
          (r.reportedByDetails
            ? {
                _id: String(r.reportedByDetails.providerId || ""),
                name: r.reportedByDetails.providerName || "Unknown",
                email: r.reportedByDetails.providerEmail || "",
                phoneNumber: "",
                userType: r.reportedByDetails.providerUserType || "",
              }
            : null),
        reportedUserId: lookupUser(r.reportedUserId || r.jobPosterId),
        relatedId: String(r.relatedId || r.jobId || ""),
        job,
        reason: normalizeReason(r.reason),
        rawReason: r.reason,
        comment: r.comment || "",
        status: normalizeStatus(r.status),
        rawStatus: r.status,
        reviewedBy: lookupUser(r.reviewedBy),
        reviewedAt: r.reviewedAt || null,
        adminNotes: r.adminNotes || "",
        actionTaken: r.actionTaken || "none",
        reportMetadata: r.reportMetadata || { reportSource: "web" },
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    };

    const fromPost = (p) => ({
      _id: String(p._id),
      source: "reported_post",
      reportType: "job",
      reportedBy:
        lookupUser(p.reportedBy) ||
        (p.reportedByDetails
          ? {
              _id: String(p.reportedByDetails.providerId || ""),
              name: p.reportedByDetails.providerName || "Unknown",
              email: p.reportedByDetails.providerEmail || "",
              phoneNumber: "",
              userType: p.reportedByDetails.providerUserType || "",
            }
          : null),
      // The reported party is whoever posted the job being reported.
      reportedUserId: lookupUser(p.reportedUserId || p.jobPosterId),
      relatedId: String(p.jobId || ""),
      job: resolveJob(p.jobId, p.jobDetails),
      reason: normalizeReason(p.reason),
      rawReason: p.reason,
      comment: p.comment || "",
      status: normalizeStatus(p.status),
      rawStatus: p.status,
      reviewedBy: lookupUser(p.reviewedBy),
      reviewedAt: p.reviewedAt || null,
      // ReportedPost has no actionTaken column.
      adminNotes: p.adminNotes || "",
      actionTaken: "none",
      reportMetadata: { reportSource: "web" },
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });

    const merged = [...rawReports.map(fromReport), ...rawPosts.map(fromPost)];

    const dir = sortOrder === "asc" ? 1 : -1;
    merged.sort((a, b) => {
      const av = a[sortBy] ?? a.createdAt;
      const bv = b[sortBy] ?? b.createdAt;
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });

    // Stats are counted off the normalized rows so the cards can never disagree
    // with the table underneath them.
    const stats = REPORT_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {
      total: merged.length,
    });
    for (const item of merged) stats[item.status] = (stats[item.status] || 0) + 1;
    stats.open_total = OPEN_REPORT_STATUSES.reduce(
      (sum, s) => sum + (stats[s] || 0),
      0
    );
    stats.bySource = {
      report: merged.filter((m) => m.source === "report").length,
      reported_post: merged.filter((m) => m.source === "reported_post").length,
    };

    const limitNum = Math.max(1, parseInt(limit, 10) || 500);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * limitNum;
    const pageItems = merged.slice(skip, skip + limitNum);

    return res.json({
      success: true,
      data: {
        reports: pageItems,
        stats,
        pagination: {
          current: pageNum,
          total: Math.ceil(merged.length / limitNum) || 1,
          totalReports: merged.length,
          hasNext: skip + pageItems.length < merged.length,
          hasPrev: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching combined reports:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
};

// Create a new report
exports.createReport = async (req, res) => {
  const { reportType, relatedId, reportedUserId, reason, comment } = req.body;
  const userId = req.user.id;

  try {
    // Validate required fields
    if (!reportType || !relatedId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Report type, related ID, and reason are required"
      });
    }

    // Check if user is trying to report themselves
    if (reportedUserId && reportedUserId === userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot report yourself"
      });
    }

    // Check if user already reported this item
    const existingReport = await Report.findOne({
      reportType,
      relatedId,
      reportedBy: userId
    });

    if (existingReport) {
      return res.status(403).json({
        success: false,
        message: "You have already reported this item"
      });
    }

    // Create the report
    const report = new Report({
      reportType,
      relatedId,
      reportedUserId,
      reportedBy: userId,
      reason,
      comment: comment || "",
      reportMetadata: {
        reporterIP: req.ip,
        reporterUserAgent: req.get("User-Agent"),
        reportSource: "web"
      }
    });

    await report.save();

    // Populate user details for response
    await report.populate([
      { path: "reportedBy", select: "name email userType" },
      { path: "reportedUserId", select: "name email userType" }
    ]);

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      data: report
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit report",
      error: error.message
    });
  }
};

// Admin: update status for ReportedPost
exports.updateReportedPostStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const { reportId } = req.params;
    const adminId = req.user.id;

    // Admin-driven transitions only — "escalated" is set by the client-app
    // dispute flow, never picked here. See constants/reportTaxonomy.js.
    const allowed = ["under_review", "action_taken", "dismissed"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const report = await ReportedPost.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Reported post not found" });
    }

    if (status) {
      report.status = status;
      report.reviewedBy = adminId;
      report.reviewedAt = new Date();
    }
    if (adminNotes !== undefined) {
      report.adminNotes = adminNotes;
    }

    // Validate only what this handler touched. save() validates every path by
    // default, which rejected legacy rows over fields the admin never edited —
    // documents still holding the retired reasons ("scam", "fake_job") could not
    // be actioned at all. Those values are mapped for display on read; there is
    // no reason a moderation decision should be blocked by them.
    await report.save({ validateModifiedOnly: true });

    const updated = await ReportedPost.findById(reportId)
      .populate("jobId", "title description category budget budgetType paymentMethod location media createdAt status")
      .populate("reportedBy", "name email userType")
      .populate("jobPosterId", "name email userType")
      .populate("reportedUserId", "name email userType")
      .lean();

    const postTitle = updated?.jobId?.title;
    await auditLog(req, "report_reviewed", `${status ? `Marked report as ${statusText(status)}` : "Updated report notes"}${postTitle ? ` on job "${postTitle}"` : ""}`, {
      targetType: "report",
      targetId: report._id,
      targetModel: "ReportedPost",
      metadata: { status: status || null, adminNotes: adminNotes ?? null, targetName: postTitle || null },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updateReportedPostStatus error", error);
    return res.status(500).json({ success: false, message: "Failed to update reported post" });
  }
};

// Admin: list reported posts (ReportedPost collection)
exports.getAllReportedPosts = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      reason
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (reason) query.reason = reason;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [reports, total] = await Promise.all([
      ReportedPost.find(query)
        .populate(
          "jobId",
          "title description category budget budgetType paymentMethod location media createdAt status"
        )
        .populate("reportedBy", "name email userType")
        .populate("jobPosterId", "name email userType")
        .populate("reportedUserId", "name email userType")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ReportedPost.countDocuments(query)
    ]);

    const statsAgg = await ReportedPost.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const stats = { total: total, pending: 0, reviewed: 0, resolved: 0, dismissed: 0 };
    statsAgg.forEach((s) => {
      stats[s._id] = s.count;
    });

    const normalizedReports = reports.map((r) => {
      const jobDetails = r.jobDetails || {};
      const jobIdObj = r.jobId || {
        _id: jobDetails._id || jobDetails.jobId || undefined,
        title: jobDetails.title,
        description: jobDetails.description,
        category: jobDetails.category,
        budget: jobDetails.budget,
        budgetType: jobDetails.budgetType,
        paymentMethod: jobDetails.paymentMethod,
        location: jobDetails.location,
        createdAt: jobDetails.createdAt,
      };

      return {
        ...r,
        jobId: jobIdObj,
      };
    });

    return res.json({
      success: true,
      reports: normalizedReports,
      stats,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limitNum),
        totalReports: total,
        hasNext: skip + reports.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error fetching reported posts:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch reported posts" });
  }
};

// Get all reports (admin only)
exports.getAllReports = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      reason,
      reportType
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (reason) query.reason = reason;
    if (reportType) query.reportType = reportType;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get reports
    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("reportedBy", "name email userType")
        .populate("reportedUserId", "name email userType")
        .populate("reviewedBy", "name email userType")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Report.countDocuments(query)
    ]);

    // Get stats
    const stats = await Report.getReportStats();

    res.json({
      success: true,
      data: {
        reports,
        stats,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limitNum),
          totalReports: total,
          hasNext: skip + limitNum < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message
    });
  }
};

// Get report statistics (admin only)
exports.getReportStats = async (req, res) => {
  try {
    const { reportType } = req.query;

    const stats = await Report.getReportStats(reportType);

    // Get additional stats
    const [
      todayReports,
      thisWeekReports,
      thisMonthReports
    ] = await Promise.all([
      Report.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }),
      Report.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }),
      Report.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setDate(1))
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        ...stats,
        today: todayReports,
        thisWeek: thisWeekReports,
        thisMonth: thisMonthReports
      }
    });
  } catch (error) {
    console.error("Error fetching report stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report statistics",
      error: error.message
    });
  }
};

// Update report status (admin only)
exports.updateReportStatus = async (req, res) => {
  try {
    const { status, adminNotes, actionTaken } = req.body;
    const { reportId } = req.params;
    const adminId = req.user.id;

    // Validate status
    // Admin-driven transitions only — see constants/reportTaxonomy.js.
    const validStatuses = ["under_review", "action_taken", "dismissed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    // Find and update report
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    // Update fields
    report.status = status;
    report.reviewedBy = adminId;
    report.reviewedAt = new Date();
    
    if (adminNotes) report.adminNotes = adminNotes;
    if (actionTaken) report.actionTaken = actionTaken;

    // Modified paths only — see updateReportedPostStatus. Legacy rows copied out
    // of ReportedPost never got reportType/relatedId, and full-document
    // validation made them permanently un-actionable.
    await report.save({ validateModifiedOnly: true });

    // Populate for response
    await report.populate([
      { path: "reportedBy", select: "name email userType" },
      { path: "reportedUserId", select: "name email userType" },
      { path: "reviewedBy", select: "name email userType" }
    ]);

    const reportedName = report.reportedUserId?.name;
    await auditLog(req, "report_reviewed", `Marked ${report.reportType || ""} report as ${statusText(status)}${reportedName ? ` (against ${reportedName})` : ""}${actionTaken ? `. Action: ${actionTaken}` : ""}`.replace(/\s+/g, " "), {
      targetType: "report",
      targetId: report._id,
      targetModel: "Report",
      metadata: { status, actionTaken: actionTaken || null, reportType: report.reportType, targetName: reportedName || null },
    });

    res.json({
      success: true,
      message: "Report updated successfully",
      data: report
    });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update report",
      error: error.message
    });
  }
};

// Check if user has reported an item
exports.checkUserReported = async (req, res) => {
  try {
    const { reportType, relatedId } = req.params;
    const userId = req.user.id;

    const hasReported = await Report.hasUserReported(reportType, relatedId, userId);

    res.json({
      success: true,
      hasReported
    });
  } catch (error) {
    console.error("Error checking user report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check report status",
      error: error.message
    });
  }
};

// Get user's reports
exports.getUserReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { reportedBy: userId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("reportedUserId", "name email userType")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Report.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limitNum),
        totalReports: total
      }
    });
  } catch (error) {
    console.error("Error fetching user reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message
    });
  }
};

// Delete a report (admin only)
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findByIdAndDelete(reportId).populate("reportedUserId", "name");
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    // The report is gone, so the row keeps what it was about.
    const reportedName = report.reportedUserId?.name;
    await auditLog(req, "report_deleted", `Deleted a ${report.reportType || ""} report (${statusText(report.status)})${reportedName ? ` against ${reportedName}` : ""}`.replace(/\s+/g, " "), {
      targetType: "report",
      metadata: { reportId, reportType: report.reportType, reason: report.reason, status: report.status, targetName: reportedName || null },
    });

    res.json({
      success: true,
      message: "Report deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report",
      error: error.message
    });
  }
};

// Get report details
exports.getReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId)
      .populate("reportedBy", "name email userType")
      .populate("reportedUserId", "name email userType")
      .populate("reviewedBy", "name email userType");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error("Error fetching report details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report details",
      error: error.message
    });
  }
};

// Admin: decide many reports at once, from either collection — the Flagged
// page's bulk triage. Only reports still awaiting a decision (open, under review)
// change; anything already closed is skipped rather than overwritten, so a stale
// selection can't undo another admin's ruling. One audit row covers the batch.
//
// Set-based on purpose: per collection it is one read, one conditional
// updateMany and one read-back, however many reports are selected — a report at
// a time was two round trips each, minutes for a few hundred against a distant
// database. The update's own filter re-checks the status, so a report closed by
// someone else between the read and the write is skipped, not overwritten.
const BULK_STATUSES = ["under_review", "action_taken", "dismissed"];
const BULK_LIMIT = 500;
const BULK_VERBS = { under_review: "Marked under review", action_taken: "Resolved", dismissed: "Dismissed" };
const canonicalStatus = (status) => LEGACY_STATUS_MAP[status] || status;
// Stored values (canonical and legacy) that still await a decision.
const STORED_OPEN_STATUSES = [...REPORT_STATUSES, ...Object.keys(LEGACY_STATUS_MAP)].filter((s) =>
  OPEN_REPORT_STATUSES.includes(canonicalStatus(s))
);

exports.bulkUpdateReportStatus = async (req, res) => {
  try {
    const { items, status, adminNotes, actionTaken } = req.body || {};

    if (!BULK_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one report" });
    }
    if (items.length > BULK_LIMIT) {
      return res.status(400).json({ success: false, message: `At most ${BULK_LIMIT} reports at a time` });
    }
    const wellFormed = items.every(
      (item) => item && mongoose.Types.ObjectId.isValid(item.id) && ["report", "reported_post"].includes(item.source)
    );
    if (!wellFormed) {
      return res.status(400).json({ success: false, message: "Invalid report reference" });
    }

    const adminId = req.user.id;
    const now = new Date();
    const note = typeof adminNotes === "string" && adminNotes.trim() ? adminNotes.trim() : null;
    // A report can move to `status` only from an open state other than `status` itself.
    const movableFrom = STORED_OPEN_STATUSES.filter((s) => canonicalStatus(s) !== status);
    const updated = [];
    const skipped = [];
    const failed = [];

    for (const source of ["report", "reported_post"]) {
      const Model = source === "report" ? Report : ReportedPost;
      const ids = [...new Set(items.filter((item) => item.source === source).map((item) => String(item.id)))];
      if (!ids.length) continue;

      try {
        const current = new Map(
          (await Model.find({ _id: { $in: ids } }).select("status").lean()).map((doc) => [String(doc._id), canonicalStatus(doc.status)])
        );
        const candidates = [];
        for (const id of ids) {
          const was = current.get(id);
          if (!was) skipped.push({ id, source, reason: "not found" });
          else if (!OPEN_REPORT_STATUSES.includes(was) || was === status) skipped.push({ id, source, reason: `already ${statusText(was)}` });
          else candidates.push(id);
        }
        if (!candidates.length) continue;

        const set = { status, reviewedBy: adminId, reviewedAt: now };
        if (note) set.adminNotes = note;
        // ReportedPost has no actionTaken column; a decision on a Report records one.
        if (source === "report" && status !== "under_review") {
          set.actionTaken = actionTaken || (status === "dismissed" ? "report_dismissed" : "none");
        }
        await Model.updateMany({ _id: { $in: candidates }, status: { $in: movableFrom } }, { $set: set });

        // Which ones this request changed: exactly those now stamped with its time.
        const changed = new Set(
          (await Model.find({ _id: { $in: candidates }, reviewedAt: now, status }).select("_id").lean()).map((doc) => String(doc._id))
        );
        for (const id of candidates) {
          if (changed.has(id)) updated.push({ id, source });
          else skipped.push({ id, source, reason: "changed by someone else meanwhile" });
        }
      } catch (error) {
        console.error(`bulkUpdateReportStatus (${source}) error`, error);
        for (const id of ids) {
          if (!updated.some((u) => u.id === id) && !skipped.some((s) => s.id === id)) failed.push({ id, source, error: error.message });
        }
      }
    }

    if (updated.length) {
      const n = updated.length;
      await auditLog(
        req,
        "reports_bulk_reviewed",
        `${BULK_VERBS[status]} ${n} report${n === 1 ? "" : "s"} at once${skipped.length ? ` (${skipped.length} skipped)` : ""}${note ? `. Note: ${note}` : ""}`,
        {
          targetType: "report",
          metadata: { status, count: n, skipped: skipped.length, failed: failed.length, reports: updated, adminNotes: note },
        }
      );
    }

    return res.json({ success: true, updated: updated.length, skipped, failed });
  } catch (error) {
    console.error("bulkUpdateReportStatus error", error);
    return res.status(500).json({ success: false, message: "Failed to update reports" });
  }
};
