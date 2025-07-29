const express = require('express');
const { 
  getUsers, 
  restrictUser, 
  banUser, 
  suspendUser, 
  unrestrictUser, 
  verifyUser, 
  getUserDetails 
} = require('../controllers/userController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get users with pagination and filtering
router.get('/', adminAuth, getUsers);

// Get specific user details
router.get('/:userId', adminAuth, getUserDetails);

// User verification
router.patch('/:userId/verify', adminAuth, verifyUser);

// User restriction actions
router.patch('/:userId/restrict', adminAuth, restrictUser);
router.patch('/:userId/ban', adminAuth, banUser);
router.patch('/:userId/suspend', adminAuth, suspendUser);
router.patch('/:userId/unrestrict', adminAuth, unrestrictUser);

module.exports = router;