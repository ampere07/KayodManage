const express = require('express');
const {
  getReportedPosts,
  getReportedPostById,
  reviewReportedPost,
  createReport,
  getReportsSummary,
  bulkUpdateReports,
  getAdminStats,
  getAllAdmins,
  getAdminById,
  getAdminActivity,
  getAdminSessions,
  createAdmin,
  updateAdmin,
  updateAdminPermissions
} = require('../controllers/adminController');
const {
  getAllVerifications,
  getVerificationById,
  getVerificationByUserId,
  updateVerificationStatus,
  getVerificationStats,
  getUserImages
} = require('../controllers/verificationController');
const {
  getActivityLogs,
  getAuditCatalog,
  getAuditTeam,
  exportActivityLogs,
  getActivityLogDetail
} = require('../controllers/activityLogController');
const {
  dismissAlert,
  resetAlerts,
  cleanupOldAlertFields
} = require('../controllers/alertController');
const { adminAuth, authMiddleware, requireSuperAdmin } = require('../middleware/auth');
const { autoApproveTopups } = require('../utils/autoApproveTopups');
const { auditLog } = require('../utils/activityLogger');
const DismissedAlert = require('../models/DismissedAlert');

const router = express.Router();

router.get('/reported-posts', adminAuth, getReportedPosts);
router.get('/reported-posts/summary', adminAuth, getReportsSummary);
router.get('/reported-posts/:reportId', adminAuth, getReportedPostById);
router.put('/reported-posts/:reportId/review', adminAuth, reviewReportedPost);
router.patch('/reported-posts/bulk-update', adminAuth, bulkUpdateReports);

router.post('/report-post', authMiddleware, createReport);

router.get('/verifications', adminAuth, getAllVerifications);
router.get('/verifications/stats', adminAuth, getVerificationStats);
router.get('/verifications/user/:userId', adminAuth, getVerificationByUserId);
router.get('/verifications/:verificationId', adminAuth, getVerificationById);
router.patch('/verifications/:verificationId', adminAuth, updateVerificationStatus);

// Optional query param: ?attempt=1 (1-based)
router.get('/users/:userId/images', adminAuth, getUserImages);

// The audit log and admin management are superadmin-only on the server, not
// just hidden in the sidebar: an admin who could reach them could grant
// themselves access, or read what everyone else has been doing.
router.get('/activity-logs', requireSuperAdmin, getActivityLogs);
router.get('/activity-logs/catalog', requireSuperAdmin, getAuditCatalog);
router.get('/activity-logs/team', requireSuperAdmin, getAuditTeam);
router.get('/activity-logs/export', requireSuperAdmin, exportActivityLogs);
// After the fixed paths above, so 'catalog' and 'team' aren't read as ids.
router.get('/activity-logs/:logId', requireSuperAdmin, getActivityLogDetail);

router.patch('/alerts/:alertId/dismiss', adminAuth, dismissAlert);
router.post('/alerts/reset', adminAuth, resetAlerts);
router.post('/alerts/cleanup', adminAuth, cleanupOldAlertFields);

router.get('/stats', adminAuth, getAdminStats);

router.get('/admins', requireSuperAdmin, getAllAdmins);

router.get('/admins/:adminId/activity', requireSuperAdmin, getAdminActivity);

router.get('/admins/:adminId/sessions', requireSuperAdmin, getAdminSessions);

router.get('/admins/:adminId', requireSuperAdmin, getAdminById);

router.post('/admins', requireSuperAdmin, createAdmin);

router.patch('/admins/:adminId/permissions', requireSuperAdmin, updateAdminPermissions);

router.patch('/admins/:adminId', requireSuperAdmin, updateAdmin);

// Manual trigger for auto-approving top-ups
router.post('/approve-topups-now', adminAuth, async (req, res) => {
  try {
    const result = await autoApproveTopups();
    if (result?.approved > 0) {
      await auditLog(req, 'bulk_transaction_approval', `Ran top-up auto-approval now: ${result.approved} approved`, {
        targetType: 'transaction',
        metadata: { count: result.approved, failed: result.failed || 0, manualRun: true }
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error manually triggering top-up approval:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve top-ups',
      details: error.message
    });
  }
});

// Debug routes
router.get('/debug/my-id', adminAuth, (req, res) => {
  res.json({
    adminId: req.admin?.id || req.user?.id,
    adminEmail: req.admin?.email || req.user?.email,
    adminName: req.admin?.name || req.user?.name,
    fullAdmin: req.admin,
    fullUser: req.user
  });
});

router.get('/debug/my-dismissed-alerts', adminAuth, async (req, res) => {
  try {
    const adminId = req.admin?.id || req.user?.id;
    const dismissed = await DismissedAlert.find({ adminId });
    res.json({
      adminId,
      count: dismissed.length,
      dismissed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/debug/all-dismissed-alerts', adminAuth, async (req, res) => {
  try {
    const dismissed = await DismissedAlert.find({});
    res.json({
      count: dismissed.length,
      dismissed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
