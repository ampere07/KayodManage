const Transaction = require('../models/Transaction');
const FeeRecord = require('../models/FeeRecord');
const User = require('../models/User');
const Job = require('../models/Job');

const getTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const search = req.query.search;
    const type = req.query.type;
    const status = req.query.status;
    const paymentMethod = req.query.paymentMethod;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    const includeFeatures = req.query.includeFees === 'true';
    
    let query = {};
    let dateQuery = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by type
    if (type && type !== 'all') {
      if (type === 'fee_record') {
        // Will handle fee records separately
      } else {
        query.type = type;
      }
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      if (dateFrom) {
        dateQuery.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        dateQuery.$lte = endDate;
      }
      query.createdAt = dateQuery;
    }
    
    console.log('Transactions query:', query); // Debug log
    
    // Fetch regular transactions
    const transactions = await Transaction.find(query)
      .populate('fromUser', 'name email phone location')
      .populate('toUser', 'name email phone location')
      .populate('fromUserId', 'name email phone location')
      .populate('toUserId', 'name email phone location')
      .populate('jobId', 'title category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`Found ${transactions.length} transactions`); // Debug log

    // Transform transactions for frontend compatibility
    const transformedTransactions = transactions.map(tx => {
      const fromUserData = tx.fromUser || tx.fromUserId;
      const toUserData = tx.toUser || tx.toUserId;
      
      // Extract xendit payment method from metadata if available
      let displayPaymentMethod = tx.paymentMethod;
      if (tx.type === 'xendit_topup' && tx.metadata?.xenditPaymentMethod) {
        displayPaymentMethod = tx.metadata.xenditPaymentMethod;
      }
      
      return {
        ...tx,
        _id: tx._id,
        transactionType: 'transaction',
        fromUserData: fromUserData,
        toUserData: toUserData,
        fromUser: fromUserData,
        toUser: toUserData,
        job: tx.jobId,
        userId: fromUserData,
        user: fromUserData,
        paymentMethod: displayPaymentMethod
      };
    });

    let allTransactions = transformedTransactions;
    let totalCount = await Transaction.countDocuments(query);

    // Include fee records if requested or if filtering for fee_record type
    if (includeFeatures || type === 'fee_record') {
      let feeQuery = {};
      
      // Apply similar filters to fee records
      if (status && status !== 'all') {
        if (status === 'completed') {
          feeQuery.status = 'paid';
        } else if (status === 'pending') {
          feeQuery.status = { $in: ['pending', 'overdue'] };
        } else if (status === 'failed') {
          feeQuery.status = 'cancelled';
        }
      }
      
      if (search) {
        // For fee records, we can't search description directly, but we can search related job
        const searchedJobs = await Job.find({
          title: { $regex: search, $options: 'i' }
        }).select('_id');
        
        if (searchedJobs.length > 0) {
          feeQuery.job = { $in: searchedJobs.map(j => j._id) };
        }
      }
      
      if (paymentMethod && paymentMethod !== 'all') {
        feeQuery.paymentMethod = paymentMethod;
      }
      
      if (dateFrom || dateTo) {
        feeQuery.createdAt = dateQuery;
      }
      
      console.log('Fee records query:', feeQuery); // Debug log
      
      const feeRecords = await FeeRecord.find(feeQuery)
        .populate({
          path: 'providerId',
          select: 'name email phone location'
        })
        .populate({
          path: 'jobId',
          select: 'title category assignedToId',
          populate: {
            path: 'assignedToId',
            select: 'name email phone location'
          }
        })
        .populate({
          path: 'transaction',
          select: '_id'
        })
        .sort({ createdAt: -1 })
        .skip(type === 'fee_record' ? skip : 0)
        .limit(type === 'fee_record' ? limit : 50)
        .lean();

      console.log(`Found ${feeRecords.length} fee records`);
      
      feeRecords.forEach((fee, index) => {
        console.log(`Fee Record ${index + 1}:`, {
          feeId: fee._id,
          provider: fee.providerId,
          job: fee.jobId,
          hasProvider: !!fee.providerId,
          hasJob: !!fee.jobId,
          hasAssignedTo: !!fee.jobId?.assignedToId
        });
      });

      const transformedFeeRecords = feeRecords.map(fee => {
        let description = fee.description;
        if (!description) {
          if (fee.jobId && fee.jobId.title) {
            description = `Platform fee for job: ${fee.jobId.title}`;
          } else {
            description = `Platform fee (₱${fee.amount})`;
          }
        }
        
        const providerInfo = fee.jobId?.assignedToId || fee.providerId || {
          _id: null,
          name: 'Unknown Provider',
          email: 'N/A'
        };
        
        return {
          _id: fee._id,
          transactionType: 'fee_record',
          fromUser: providerInfo,
          toUser: providerInfo,
          fromUserData: providerInfo,
          toUserData: providerInfo,
          user: providerInfo,
          userId: providerInfo,
          amount: fee.amount,
          type: 'fee_payment',
          status: fee.status === 'paid' ? 'completed' : 
                  fee.status === 'cancelled' ? 'failed' : 'pending',
          jobId: fee.jobId || null,
          job: fee.jobId || null,
          description: description,
          paymentMethod: fee.paymentMethod || 'wallet',
          currency: 'PHP',
          createdAt: fee.createdAt,
          updatedAt: fee.updatedAt,
          completedAt: fee.paidAt,
          originalFeeRecord: fee,
          dueDate: fee.dueDate,
          isFirstOffense: fee.isFirstOffense,
          penaltyApplied: fee.penaltyApplied,
          remindersSent: fee.remindersSent
        };
      });

      if (type === 'fee_record') {
        // If specifically filtering for fee records, return only those
        allTransactions = transformedFeeRecords;
        totalCount = await FeeRecord.countDocuments(feeQuery);
      } else {
        // Merge transactions and fee records
        allTransactions = [...transformedTransactions, ...transformedFeeRecords];
        // Sort merged results by date
        allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        // Apply pagination to merged results
        allTransactions = allTransactions.slice(skip, skip + limit);
        totalCount = totalCount + await FeeRecord.countDocuments(feeQuery);
      }
    }
    
    const pages = Math.ceil(totalCount / limit);
    
    res.json({
      transactions: allTransactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

const getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { type } = req.query; // 'transaction' or 'fee_record'
    
    let transactionData;
    
    if (type === 'fee_record') {
      transactionData = await FeeRecord.findById(transactionId)
        .populate({
          path: 'providerId',
          select: 'name email phone location'
        })
        .populate({
          path: 'jobId',
          select: 'title description category assignedToId',
          populate: {
            path: 'assignedToId',
            select: 'name email phone location'
          }
        })
        .populate({
          path: 'transaction',
          select: '_id amount status'
        })
        .lean();
      
      if (transactionData) {
        let description = transactionData.description;
        if (!description) {
          if (transactionData.jobId && transactionData.jobId.title) {
            description = `Platform fee for job: ${transactionData.jobId.title}`;
          } else {
            description = `Platform fee (₱${transactionData.amount})`;
          }
        }
        
        const providerInfo = transactionData.jobId?.assignedToId || transactionData.providerId || {
          _id: null,
          name: 'Unknown Provider',
          email: 'N/A',
          phone: 'N/A'
        };
        
        transactionData = {
          ...transactionData,
          transactionType: 'fee_record',
          fromUser: providerInfo,
          toUser: providerInfo,
          type: 'fee_payment',
          status: transactionData.status === 'paid' ? 'completed' : 
                  transactionData.status === 'cancelled' ? 'failed' : 'pending',
          description: description,
          currency: 'PHP'
        };
      }
    } else {
      transactionData = await Transaction.findById(transactionId)
        .populate('fromUser', 'name email phone location')
        .populate('toUser', 'name email phone location')
        .populate('fromUserId', 'name email phone location')
        .populate('toUserId', 'name email phone location')
        .populate('jobId', 'title description category')
        .lean();
      
      if (transactionData) {
        const fromUserData = transactionData.fromUser || transactionData.fromUserId;
        const toUserData = transactionData.toUser || transactionData.toUserId;
        
        // Extract xendit payment method from metadata if available
        let displayPaymentMethod = transactionData.paymentMethod;
        if (transactionData.type === 'xendit_topup' && transactionData.metadata?.xenditPaymentMethod) {
          displayPaymentMethod = transactionData.metadata.xenditPaymentMethod;
        }
        
        transactionData.transactionType = 'transaction';
        transactionData.fromUserData = fromUserData;
        transactionData.toUserData = toUserData;
        transactionData.fromUser = fromUserData;
        transactionData.toUser = toUserData;
        transactionData.job = transactionData.jobId;
        transactionData.paymentMethod = displayPaymentMethod;
      }
    }
    
    if (!transactionData) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transactionData);
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
};

const updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, type } = req.body;
    
    if (type === 'fee_record') {
      return res.status(403).json({ error: 'Fee records are read-only and cannot be updated from transactions' });
    }
    
    // Check if it's a xendit_topup transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.type === 'xendit_topup') {
      return res.status(403).json({ error: 'Top-up transactions are read-only and cannot be manually updated' });
    }
    
    const validStatuses = ['pending', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const updateData = { 
      status,
      ...(status === 'completed' && { completedAt: new Date() }),
      ...(status === 'failed' && { failedAt: new Date() })
    };
    
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      updateData,
      { new: true }
    )
    .populate('fromUser', 'name email phone location')
    .populate('toUser', 'name email phone location')
    .populate('fromUserId', 'name email phone location')
    .populate('toUserId', 'name email phone location')
    .populate('jobId', 'title category')
    .lean();
    
    if (updatedTransaction) {
      const fromUserData = updatedTransaction.fromUser || updatedTransaction.fromUserId;
      const toUserData = updatedTransaction.toUser || updatedTransaction.toUserId;
      
      updatedTransaction.transactionType = 'transaction';
      updatedTransaction.fromUserData = fromUserData;
      updatedTransaction.toUserData = toUserData;
      updatedTransaction.fromUser = fromUserData;
      updatedTransaction.toUser = toUserData;
      updatedTransaction.job = updatedTransaction.jobId;
      updatedTransaction.userId = fromUserData;
    }
    
    if (!updatedTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('transaction:updated', {
      transaction: updatedTransaction,
      updateType: `status changed to ${status}`
    });
    
    res.json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: 'Failed to update transaction status' });
  }
};

const getTransactionStats = async (req, res) => {
  try {
    const totalTransactions = await Transaction.countDocuments();
    const completedTransactions = await Transaction.countDocuments({ status: 'completed' });
    const pendingTransactions = await Transaction.countDocuments({ status: 'pending' });
    const failedTransactions = await Transaction.countDocuments({ status: 'failed' });
    
    // Calculate total revenue from completed transactions
    const revenueData = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' }, totalFees: { $sum: '$platformFee' } } }
    ]);
    
    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
    const totalPlatformFees = revenueData.length > 0 ? revenueData[0].totalFees : 0;
    
    // Fee records stats
    const totalFeeRecords = await FeeRecord.countDocuments();
    const paidFees = await FeeRecord.countDocuments({ status: 'paid' });
    const pendingFees = await FeeRecord.countDocuments({ status: { $in: ['pending', 'overdue'] } });
    
    const feeRevenueData = await FeeRecord.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, totalFeeRevenue: { $sum: '$amount' } } }
    ]);
    
    const totalFeeRevenue = feeRevenueData.length > 0 ? feeRevenueData[0].totalFeeRevenue : 0;
    
    res.json({
      totalTransactions,
      completedTransactions,
      pendingTransactions,
      failedTransactions,
      totalRevenue,
      totalPlatformFees,
      totalFeeRecords,
      paidFees,
      pendingFees,
      totalFeeRevenue,
      combinedRevenue: totalRevenue + totalFeeRevenue
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({ error: 'Failed to fetch transaction stats' });
  }
};

module.exports = { 
  getTransactions, 
  getTransactionDetails, 
  updateTransactionStatus,
  getTransactionStats 
};
