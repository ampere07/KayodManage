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
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`Found ${transactions.length} transactions`); // Debug log

    // Transform transactions for frontend compatibility
    const transformedTransactions = transactions.map(tx => ({
      ...tx,
      _id: tx._id,
      transactionType: 'transaction', // Mark as regular transaction
      fromUserData: tx.fromUser,
      toUserData: tx.toUser,
      job: tx.jobId,
      // For compatibility with old frontend structure
      userId: tx.fromUser,
      user: tx.fromUser
    }));

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
        .populate('provider', 'name email')
        .populate('job', 'title')
        .populate('transaction', '_id')
        .sort({ createdAt: -1 })
        .skip(type === 'fee_record' ? skip : 0)
        .limit(type === 'fee_record' ? limit : 50) // Limit fee records if not specifically filtering
        .lean();

      console.log(`Found ${feeRecords.length} fee records`); // Debug log

      // Transform fee records to match transaction structure
      const transformedFeeRecords = feeRecords.map(fee => ({
        _id: fee._id,
        transactionType: 'fee_record', // Mark as fee record
        fromUser: fee.provider,
        toUser: fee.provider, // Fee is from provider to platform
        fromUserData: fee.provider,
        toUserData: fee.provider,
        user: fee.provider,
        userId: fee.provider,
        amount: fee.amount,
        type: 'fee_payment',
        status: fee.status === 'paid' ? 'completed' : 
                fee.status === 'cancelled' ? 'failed' : 'pending',
        jobId: fee.job,
        job: fee.job,
        description: `Platform fee for job: ${fee.job ? fee.job.title : 'Unknown job'}`,
        paymentMethod: fee.paymentMethod,
        currency: 'PHP',
        createdAt: fee.createdAt,
        updatedAt: fee.updatedAt,
        completedAt: fee.paidAt,
        // Fee-specific fields
        originalFeeRecord: fee,
        dueDate: fee.dueDate,
        isFirstOffense: fee.isFirstOffense,
        penaltyApplied: fee.penaltyApplied,
        remindersSent: fee.remindersSent
      }));

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
        .populate('provider', 'name email phone')
        .populate('job', 'title description')
        .populate('transaction', '_id amount status')
        .lean();
      
      if (transactionData) {
        // Transform fee record to transaction-like structure
        transactionData = {
          ...transactionData,
          transactionType: 'fee_record',
          fromUser: transactionData.provider,
          toUser: transactionData.provider,
          type: 'fee_payment',
          status: transactionData.status === 'paid' ? 'completed' : 
                  transactionData.status === 'cancelled' ? 'failed' : 'pending',
          description: `Platform fee for job: ${transactionData.job ? transactionData.job.title : 'Unknown job'}`,
          currency: 'PHP'
        };
      }
    } else {
      transactionData = await Transaction.findById(transactionId)
        .populate('fromUser', 'name email phone')
        .populate('toUser', 'name email phone')
        .populate('jobId', 'title description')
        .lean();
      
      if (transactionData) {
        transactionData.transactionType = 'transaction';
        transactionData.fromUserData = transactionData.fromUser;
        transactionData.toUserData = transactionData.toUser;
        transactionData.job = transactionData.jobId;
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
    
    const validStatuses = ['pending', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    let updatedTransaction;
    
    if (type === 'fee_record') {
      // Update fee record status
      const feeStatus = status === 'completed' ? 'paid' : 
                      status === 'failed' ? 'cancelled' : 'pending';
      
      const updateData = { 
        status: feeStatus,
        ...(status === 'completed' && { paidAt: new Date() })
      };
      
      updatedTransaction = await FeeRecord.findByIdAndUpdate(
        transactionId,
        updateData,
        { new: true }
      )
      .populate('provider', 'name email')
      .populate('job', 'title')
      .lean();
      
      if (updatedTransaction) {
        // Transform back to transaction-like structure
        updatedTransaction = {
          ...updatedTransaction,
          transactionType: 'fee_record',
          fromUser: updatedTransaction.provider,
          toUser: updatedTransaction.provider,
          type: 'fee_payment',
          status: status,
          description: `Platform fee for job: ${updatedTransaction.job ? updatedTransaction.job.title : 'Unknown job'}`,
          currency: 'PHP'
        };
      }
    } else {
      // Update regular transaction
      const updateData = { 
        status,
        ...(status === 'completed' && { completedAt: new Date() }),
        ...(status === 'failed' && { failedAt: new Date() })
      };
      
      updatedTransaction = await Transaction.findByIdAndUpdate(
        transactionId,
        updateData,
        { new: true }
      )
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email')
      .populate('jobId', 'title')
      .lean();
      
      if (updatedTransaction) {
        updatedTransaction.transactionType = 'transaction';
        updatedTransaction.fromUserData = updatedTransaction.fromUser;
        updatedTransaction.toUserData = updatedTransaction.toUser;
        updatedTransaction.job = updatedTransaction.jobId;
        updatedTransaction.userId = updatedTransaction.fromUser;
      }
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