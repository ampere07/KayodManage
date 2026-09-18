const express = require('express');
const { creditTopUp } = require('../utils/creditTopUp');
const { 
  getTransactions, 
  getTransactionDetails, 
  updateTransactionStatus,
  getTransactionStats,
  approveRefund,
  declineRefund
} = require('../controllers/transactionController');
const { adminAuth, requirePermission } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

// Auto-approve all pending top-up transactions
router.post('/approve-topups', adminAuth, requirePermission('transactions'), async (req, res) => {
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
        const credited = await creditTopUp(userId, transaction.amount);
        if (!credited) {
          console.error('[topup] no wallet for', String(userId), '- transaction completed but uncredited');
        }
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


// Get transactions with pagination, search, and filtering
router.get('/', adminAuth, requirePermission('transactions'), getTransactions);

// Get transaction statistics
router.get('/stats', adminAuth, requirePermission('transactions'), getTransactionStats);

// Get specific transaction details
router.get('/:transactionId', adminAuth, requirePermission('transactions'), getTransactionDetails);

// Approve refund
router.post('/:transactionId/approve-refund', adminAuth, requirePermission('transactions'), approveRefund);

// Decline refund
router.post('/:transactionId/decline-refund', adminAuth, requirePermission('transactions'), declineRefund);

// Update transaction status
router.patch('/:transactionId/status', adminAuth, requirePermission('transactions'), updateTransactionStatus);

module.exports = router;
