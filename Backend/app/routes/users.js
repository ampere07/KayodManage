const express = require('express');
const { 
  getUsers, 
  getUserCounts,
  restrictUser, 
  banUser, 
  suspendUser, 
  unrestrictUser, 
  verifyUser, 
  getUserDetails,
  softDeleteUser,
  getUserActivity,
  getUserJobs,
  getUserFinancials,
  getUserReviews,
  getUserStanding,
  getUserPenalties
} = require('../controllers/userController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get users with pagination and filtering
router.get('/', adminAuth, getUsers);

// Card and tab counts for the Users page (type × account status × verification).
// Must stay above '/:userId', which would otherwise capture "counts" as an id.
router.get('/counts', adminAuth, getUserCounts);

// Get specific user details
router.get('/:userId', adminAuth, getUserDetails);

// Everything this user has done, across jobs, money, quotes, reviews and support
router.get('/:userId/activity', adminAuth, getUserActivity);

// Jobs the user posted, and jobs they were assigned to
router.get('/:userId/jobs', adminAuth, getUserJobs);

// Top-ups, cash-outs, earnings and spending for this user
router.get('/:userId/financials', adminAuth, getUserFinancials);

// Reviews clients left for a provider, with average, distribution and category averages
router.get('/:userId/reviews', adminAuth, getUserReviews);

// Reports against/by the user and their support tickets (counts)
router.get('/:userId/standing', adminAuth, getUserStanding);

// Restriction/suspension/ban count and latest date (the audit log is superadmin-only)
router.get('/:userId/penalties', adminAuth, getUserPenalties);

// User verification
router.patch('/:userId/verify', adminAuth, verifyUser);

// User restriction actions
router.patch('/:userId/restrict', adminAuth, restrictUser);
router.patch('/:userId/ban', adminAuth, banUser);
router.patch('/:userId/suspend', adminAuth, suspendUser);
router.patch('/:userId/unrestrict', adminAuth, unrestrictUser);
router.patch('/:userId/delete', adminAuth, softDeleteUser);

module.exports = router;