const express = require('express');
const {
  getJobs,
  getJobDetails,
  updateJobStatus,
  forceCancelJob,
  resolveDispute,
  assignJobToProvider,
  getJobStats,
  hideJob,
  unhideJob,
  deleteJob,
  restoreJob
} = require('../controllers/jobController');
const { adminAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get jobs with pagination, search, and filtering
router.get('/', adminAuth, requirePermission('jobs'), getJobs);

// Get job statistics
router.get('/stats', adminAuth, requirePermission('jobs'), getJobStats);

// Get specific job details with applications
router.get('/:jobId', adminAuth, requirePermission('jobs'), getJobDetails);

// Update job status (cancellation excluded — see force-cancel below)
router.patch('/:jobId/status', adminAuth, requirePermission('jobs'), updateJobStatus);

// Cancel a job — the only path that does the money/notification work correctly
router.post('/:jobId/force-cancel', adminAuth, requirePermission('jobs'), forceCancelJob);

// Resolve an active dispute: { outcome: 'pay_provider' | 'refund_client' | 'rebook', note? }
router.post('/:jobId/resolve-dispute', adminAuth, requirePermission('jobs'), resolveDispute);

// Hide job
router.patch('/:jobId/hide', adminAuth, requirePermission('jobs'), hideJob);

// Unhide job
router.patch('/:jobId/unhide', adminAuth, requirePermission('jobs'), unhideJob);

// Delete job
router.delete('/:jobId', adminAuth, requirePermission('jobs'), deleteJob);

// Restore job
router.patch('/:jobId/restore', adminAuth, requirePermission('jobs'), restoreJob);

// Assign job to provider
router.patch('/:jobId/assign', adminAuth, requirePermission('jobs'), assignJobToProvider);

module.exports = router;