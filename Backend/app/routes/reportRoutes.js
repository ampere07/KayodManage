const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authMiddleware, adminAuth } = require("../middleware/auth");

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/reports - Create a new report
router.post("/", reportController.createReport);

// GET /api/reports/admin/all - Get all reports (admin only)
router.get("/admin/all", adminAuth, reportController.getAllReports);

// GET /api/reported-posts/admin/all - Get all reported posts (legacy collection)
router.get("/reported-posts/admin/all", adminAuth, reportController.getAllReportedPosts);

// PUT /api/reported-posts/:reportId/status - Update reported post status (admin)
router.put("/reported-posts/:reportId/status", adminAuth, reportController.updateReportedPostStatus);

// GET /api/reports/admin/stats - Get report statistics (admin only)
router.get("/admin/stats", adminAuth, reportController.getReportStats);

// PUT /api/reports/:reportId/status - Update report status (admin only)
router.put("/:reportId/status", adminAuth, reportController.updateReportStatus);

// GET /api/reports/my - Get current user's reports
router.get("/my", reportController.getUserReports);

// GET /api/reports/:reportId/details - Get report details
router.get("/:reportId/details", reportController.getReportDetails);

// GET /api/reports/:reportType/:relatedId/check - Check if user has reported
router.get("/:reportType/:relatedId/check", reportController.checkUserReported);

// DELETE /api/reports/:reportId - Delete a report (admin only)
router.delete("/:reportId", adminAuth, reportController.deleteReport);

module.exports = router;
