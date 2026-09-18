const express = require('express');
const { getStats, getActivity, getAlerts, markAlertAsRead, getRevenueChart, getStatsComparison, getPopularJobs } = require('../controllers/dashboardController');
const { adminAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', adminAuth, requirePermission('dashboard'), getStats);
router.get('/stats-comparison', adminAuth, requirePermission('dashboard'), getStatsComparison);
router.get('/activity', adminAuth, requirePermission('dashboard'), getActivity);
router.get('/alerts', adminAuth, requirePermission('dashboard'), getAlerts);
router.get('/revenue-chart', adminAuth, requirePermission('dashboard'), getRevenueChart);
router.get('/popular-jobs', adminAuth, requirePermission('dashboard'), getPopularJobs);
router.patch('/alerts/:alertId/read', adminAuth, requirePermission('dashboard'), markAlertAsRead);

module.exports = router;