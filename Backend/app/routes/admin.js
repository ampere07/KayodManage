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
  createAdmin,
  updateAdmin,
  updateAdminPermissions
} = require('../controllers/adminController');
const {
  getAllVerifications,
  getVerificationById,
  updateVerificationStatus,
  getVerificationStats,
  getUserImages
} = require('../controllers/verificationController');
const {
  getActivityLogs
} = require('../controllers/activityLogController');
const { adminAuth, authMiddleware } = require('../middleware/auth');
const { autoApproveTopups } = require('../utils/autoApproveTopups');

const router = express.Router();

router.get('/reported-posts', adminAuth, getReportedPosts);
router.get('/reported-posts/summary', adminAuth, getReportsSummary);
router.get('/reported-posts/:reportId', adminAuth, getReportedPostById);
router.put('/reported-posts/:reportId/review', adminAuth, reviewReportedPost);
router.patch('/reported-posts/bulk-update', adminAuth, bulkUpdateReports);

router.post('/report-post', authMiddleware, createReport);

router.get('/verifications', adminAuth, getAllVerifications);
router.get('/verifications/stats', adminAuth, getVerificationStats);
router.get('/verifications/:verificationId', adminAuth, getVerificationById);
router.patch('/verifications/:verificationId', adminAuth, updateVerificationStatus);

router.get('/users/:userId/images', adminAuth, getUserImages);

router.get('/activity-logs', adminAuth, getActivityLogs);

router.get('/stats', adminAuth, getAdminStats);

router.get('/admins', adminAuth, getAllAdmins);

router.get('/admins/:adminId', adminAuth, getAdminById);

router.post('/admins', adminAuth, createAdmin);

router.patch('/admins/:adminId', adminAuth, updateAdmin);

router.patch('/admins/:adminId/permissions', adminAuth, updateAdminPermissions);

// Manual trigger for auto-approving top-ups
router.post('/approve-topups-now', adminAuth, async (req, res) => {
  try {
    const result = await autoApproveTopups();
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

module.exports = router;
