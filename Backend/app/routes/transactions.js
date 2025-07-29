const express = require('express');
const { 
  getTransactions, 
  getTransactionDetails, 
  updateTransactionStatus,
  getTransactionStats 
} = require('../controllers/transactionController');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get transactions with pagination, search, and filtering
router.get('/', adminAuth, getTransactions);

// Get transaction statistics
router.get('/stats', adminAuth, getTransactionStats);

// Get specific transaction details
router.get('/:transactionId', adminAuth, getTransactionDetails);

// Update transaction status
router.patch('/:transactionId/status', adminAuth, updateTransactionStatus);

module.exports = router;