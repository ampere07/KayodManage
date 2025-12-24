const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { logActivity } = require('./activityLogger');

/**
 * Automatically approve all pending top-up transactions
 * This function can be called manually or scheduled to run periodically
 */
const autoApproveTopups = async () => {
  try {
    // Find all pending top-up transactions
    const pendingTopups = await Transaction.find({
      type: { $in: ['xendit_topup', 'wallet_topup'] },
      status: 'pending'
    })
    .populate('fromUser', 'name email')
    .populate('fromUserId', 'name email');

    if (pendingTopups.length === 0) {
      return { success: true, approved: 0, message: 'No pending top-ups to approve' };
    }

    console.log(`[AUTO-APPROVE] Processing ${pendingTopups.length} pending top-up(s)`);
    
    const approvedTransactions = [];
    const failedTransactions = [];
    
    for (const transaction of pendingTopups) {
      try {
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
          type: transaction.type,
          userName: transaction.fromUser?.name || transaction.fromUserId?.name || 'Unknown'
        });
      } catch (error) {
        console.error(`[AUTO-APPROVE] Failed transaction ${transaction._id}:`, error.message);
        failedTransactions.push({
          id: transaction._id,
          error: error.message
        });
      }
    }

    if (approvedTransactions.length > 0 || failedTransactions.length > 0) {
      console.log(`[AUTO-APPROVE] ✓ ${approvedTransactions.length} approved, ✗ ${failedTransactions.length} failed`);
    }

    // Emit socket event if server is available
    try {
      const { io } = require('../../server');
      if (io) {
        io.to('admin').emit('transactions:auto-approved', {
          count: approvedTransactions.length,
          transactions: approvedTransactions,
          timestamp: new Date()
        });
      }
    } catch (error) {
      // Socket events are optional, silently fail
    }

    return {
      success: true,
      approved: approvedTransactions.length,
      failed: failedTransactions.length,
      transactions: approvedTransactions,
      failedTransactions: failedTransactions,
      message: `Automatically approved ${approvedTransactions.length} top-up transaction(s)`
    };
  } catch (error) {
    console.error('[AUTO-APPROVE] Error:', error.message);
    return {
      success: false,
      approved: 0,
      error: error.message,
      message: 'Failed to auto-approve top-ups'
    };
  }
};

/**
 * Start periodic auto-approval
 * @param {number} intervalMinutes - Interval in minutes (default: 5)
 */
let autoApprovalInterval = null;

const startAutoApprovalScheduler = (intervalMinutes = 5) => {
  if (autoApprovalInterval) {
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[AUTO-APPROVE] Scheduler started (${intervalMinutes} min intervals)`);
  
  // Run immediately on start
  autoApproveTopups();
  
  // Then run at intervals
  autoApprovalInterval = setInterval(async () => {
    await autoApproveTopups();
  }, intervalMs);
};

/**
 * Stop periodic auto-approval
 */
const stopAutoApprovalScheduler = () => {
  if (autoApprovalInterval) {
    clearInterval(autoApprovalInterval);
    autoApprovalInterval = null;
  }
};

module.exports = {
  autoApproveTopups,
  startAutoApprovalScheduler,
  stopAutoApprovalScheduler
};
