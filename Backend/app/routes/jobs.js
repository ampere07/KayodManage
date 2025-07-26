const express = require('express');
const { getJobs, updateJobStatus } = require('../controllers/jobController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', adminAuth, getJobs);
router.patch('/:jobId/status', adminAuth, updateJobStatus);

module.exports = router;