const express = require('express');
const {
  getReportedPosts,
  getReportedPostById,
  reviewReportedPost,
  createReport,
  getReportsSummary,
  bulkUpdateReports
} = require('../controllers/adminController');
const {
  getAllVerifications,
  getVerificationById,
  updateVerificationStatus,
  getVerificationStats,
  getUserImages
} = require('../controllers/verificationController');
const { adminAuth, authMiddleware } = require('../middleware/auth');

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

module.exports = router;
