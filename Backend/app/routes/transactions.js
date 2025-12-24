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
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

// Auto-approve all pending top-up transactions
router.post('/approve-topups', adminAuth, async (req, res) => {
  try {
    // Find all pending top-up transactions
    const pendingTopups = await Transaction.find({
      type: { $in: ['xendit_topup', 'wallet_topup'] },
      status: 'pending'
    })
    .populate('fromUser', 'name email')
    .populate('fromUserId', 'name email');

    if (pendingTopups.length === 0) {
      return res.json({
        success: true,
        message: 'No pending top-ups to approve',
        approved: 0
      });
    }

    const approvedTransactions = [];
    
    for (const transaction of pendingTopups) {
      // Update transaction status
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      await transaction.save();

      // Update user wallet balance
      const userId = transaction.fromUser?._id || transaction.fromUserId?._id;
      if (userId) {
        await User.findByIdAndUpdate(
          userId,
          { $inc: { 'wallet.balance': transaction.amount } }
        );
      }

      approvedTransactions.push({
        id: transaction._id,
        userId: userId,
        amount: transaction.amount,
        type: transaction.type
      });
    }

    // Log activity
    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'bulk_transaction_approval',
        `Auto-approved ${approvedTransactions.length} top-up transactions`,
        {
          targetType: 'transaction',
          metadata: { count: approvedTransactions.length },
          ipAddress: req.ip
        }
      );
    }

    // Emit socket event
    const { io } = require('../../server');
    io.to('admin').emit('transactions:bulk-approved', {
      count: approvedTransactions.length,
      transactions: approvedTransactions
    });

    res.json({
      success: true,
      message: `Successfully approved ${approvedTransactions.length} top-up transactions`,
      approved: approvedTransactions.length,
      transactions: approvedTransactions
    });
  } catch (error) {
    console.error('Error auto-approving top-ups:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to auto-approve top-ups',
      details: error.message 
    });
  }
});


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
