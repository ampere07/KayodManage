const express = require('express');
const { 
  getUsers, 
  restrictUser, 
  banUser, 
  suspendUser, 
  unrestrictUser, 
  verifyUser, 
  getUserDetails,
  softDeleteUser 
} = require('../controllers/userController');
const { adminAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get users with pagination and filtering
router.get('/', adminAuth, requirePermission('users'), getUsers);

// Get specific user details
router.get('/:userId', adminAuth, requirePermission('users'), getUserDetails);

// User verification
router.patch('/:userId/verify', adminAuth, requirePermission('users'), verifyUser);

// User restriction actions
router.patch('/:userId/restrict', adminAuth, requirePermission('users'), restrictUser);
router.patch('/:userId/ban', adminAuth, requirePermission('users'), banUser);
router.patch('/:userId/suspend', adminAuth, requirePermission('users'), suspendUser);
router.patch('/:userId/unrestrict', adminAuth, requirePermission('users'), unrestrictUser);
router.patch('/:userId/delete', adminAuth, requirePermission('users'), softDeleteUser);

module.exports = router;