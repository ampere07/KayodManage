const express = require('express');
const {
  getReportedPosts,
  getReportedPostById,
  reviewReportedPost,
  createReport,
  getReportsSummary,
  bulkUpdateReports
} = require('../controllers/adminController');
const { adminAuth, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Admin routes for managing reported posts
router.get('/reported-posts', adminAuth, getReportedPosts);
router.get('/reported-posts/summary', adminAuth, getReportsSummary);
router.get('/reported-posts/:reportId', adminAuth, getReportedPostById);
router.put('/reported-posts/:reportId/review', adminAuth, reviewReportedPost);
router.patch('/reported-posts/bulk-update', adminAuth, bulkUpdateReports);

// User routes for creating reports
// Note: For now using authMiddleware, but you may want to create proper user auth
router.post('/report-post', authMiddleware, createReport);

module.exports = router;