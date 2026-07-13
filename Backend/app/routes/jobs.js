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
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get jobs with pagination, search, and filtering
router.get('/', adminAuth, getJobs);

// Get job statistics
router.get('/stats', adminAuth, getJobStats);

// Get specific job details with applications
router.get('/:jobId', adminAuth, getJobDetails);

// Update job status (cancellation excluded — see force-cancel below)
router.patch('/:jobId/status', adminAuth, updateJobStatus);

// Cancel a job — the only path that does the money/notification work correctly
router.post('/:jobId/force-cancel', adminAuth, forceCancelJob);

// Resolve an active dispute: { outcome: 'pay_provider' | 'refund_client' | 'rebook', note? }
router.post('/:jobId/resolve-dispute', adminAuth, resolveDispute);

// Hide job
router.patch('/:jobId/hide', adminAuth, hideJob);

// Unhide job
router.patch('/:jobId/unhide', adminAuth, unhideJob);

// Delete job
router.delete('/:jobId', adminAuth, deleteJob);

// Restore job
router.patch('/:jobId/restore', adminAuth, restoreJob);

// Assign job to provider
router.patch('/:jobId/assign', adminAuth, assignJobToProvider);

module.exports = router;