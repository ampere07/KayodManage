const express = require('express');
const { 
  getJobs, 
  getJobDetails, 
  updateJobStatus, 
  assignJobToProvider,
  getJobStats 
} = require('../controllers/jobController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get jobs with pagination, search, and filtering
router.get('/', adminAuth, getJobs);

// Get job statistics
router.get('/stats', adminAuth, getJobStats);

// Get specific job details with applications
router.get('/:jobId', adminAuth, getJobDetails);

// Update job status
router.patch('/:jobId/status', adminAuth, updateJobStatus);

// Assign job to provider
router.patch('/:jobId/assign', adminAuth, assignJobToProvider);

module.exports = router;