const Transaction = require('../models/Transaction');

const getTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const type = req.query.type;
    const status = req.query.status;
    
    let query = {};
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const transactions = await Transaction.find(query)
      .populate('userId', 'name email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Transaction.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

const updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;
    
    const updateData = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const transaction = await Transaction.findByIdAndUpdate(transactionId, updateData, { new: true })
      .populate('userId', 'name email')
      .populate('jobId', 'title');
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('transaction:updated', {
      transaction,
      updateType: status
    });
    
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: 'Failed to update transaction status' });
  }
};

module.exports = { getTransactions, updateTransactionStatus };