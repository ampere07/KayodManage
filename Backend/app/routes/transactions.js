const express = require('express');
const { getTransactions, updateTransactionStatus } = require('../controllers/transactionController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', adminAuth, getTransactions);
router.patch('/:transactionId/status', adminAuth, updateTransactionStatus);

module.exports = router;