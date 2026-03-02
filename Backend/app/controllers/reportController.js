const Report = require("../models/Report");
const User = require("../models/User");

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
    const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];
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

    await report.save();

    // Populate for response
    await report.populate([
      { path: "reportedBy", select: "name email userType" },
      { path: "reportedUserId", select: "name email userType" },
      { path: "reviewedBy", select: "name email userType" }
    ]);

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

    const report = await Report.findByIdAndDelete(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

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
