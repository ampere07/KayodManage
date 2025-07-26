const express = require('express');
const { getStats, getActivity, getAlerts, markAlertAsRead } = require('../controllers/dashboardController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', adminAuth, getStats);
router.get('/activity', adminAuth, getActivity);
router.get('/alerts', adminAuth, getAlerts);
router.patch('/alerts/:alertId/read', adminAuth, markAlertAsRead);

module.exports = router;