const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authMiddleware } = require("../middleware/auth");

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/reports - Create a new report
router.post("/", reportController.createReport);

// GET /api/reports/admin/all - Get all reports (admin only)
router.get("/admin/all", reportController.getAllReports);

// GET /api/reports/admin/stats - Get report statistics (admin only)
router.get("/admin/stats", reportController.getReportStats);

// PUT /api/reports/:reportId/status - Update report status (admin only)
router.put("/:reportId/status", reportController.updateReportStatus);

// GET /api/reports/my - Get current user's reports
router.get("/my", reportController.getUserReports);

// GET /api/reports/:reportId/details - Get report details
router.get("/:reportId/details", reportController.getReportDetails);

// GET /api/reports/:reportType/:relatedId/check - Check if user has reported
router.get("/:reportType/:relatedId/check", reportController.checkUserReported);

// DELETE /api/reports/:reportId - Delete a report (admin only)
router.delete("/:reportId", reportController.deleteReport);

module.exports = router;
