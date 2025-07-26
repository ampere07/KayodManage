const express = require('express');
const { getUsers, restrictUser, verifyUser } = require('../controllers/userController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', adminAuth, getUsers);
router.patch('/:userId/restrict', adminAuth, restrictUser);
router.patch('/:userId/verify', adminAuth, verifyUser);

module.exports = router;