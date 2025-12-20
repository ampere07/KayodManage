const express = require('express');
const { 
  getTransactions, 
  getTransactionDetails, 
  updateTransactionStatus,
  getTransactionStats 
} = require('../controllers/transactionController');
const { adminAuth } = require('../middleware/auth');
const FeeRecord = require('../models/FeeRecord');
const Job = require('../models/Job');

const router = express.Router();

// Diagnostic endpoint to check fee records (NO AUTH for testing)
router.get('/debug/fee-records', async (req, res) => {
  try {
    console.log('Debug endpoint called!');
    
    const feeRecords = await FeeRecord.find({})
      .populate('provider', 'name')
      .populate('job', 'title _id')
      .limit(10)
      .lean();
    
    console.log(`Found ${feeRecords.length} fee records in database`);
    
    const diagnostics = feeRecords.map(fee => ({
      feeRecordId: fee._id,
      amount: fee.amount,
      jobId: fee.job?._id || 'NULL',
      jobTitle: fee.job?.title || 'NO JOB FOUND',
      providerId: fee.provider?._id,
      providerName: fee.provider?.name,
      description: fee.description,
      status: fee.status,
      createdAt: fee.createdAt
    }));
    
    res.json({
      total: feeRecords.length,
      records: diagnostics
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions with pagination, search, and filtering
router.get('/', adminAuth, getTransactions);

// Get transaction statistics
router.get('/stats', adminAuth, getTransactionStats);

// Get specific transaction details
router.get('/:transactionId', adminAuth, getTransactionDetails);

// Update transaction status
router.patch('/:transactionId/status', adminAuth, updateTransactionStatus);

module.exports = router;
