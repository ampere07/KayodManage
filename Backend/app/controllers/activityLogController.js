const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

exports.getActivityLogs = async (req, res) => {
  try {
    const { actionType, targetId, limit = 100, skip = 0 } = req.query;
    const mongoose = require('mongoose');

    const query = {};
    
    if (actionType && actionType !== 'all') {
      query.actionType = actionType;
    }

    if (targetId) {
      // Ensure targetId is a valid ObjectId string before converting
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        query.targetId = new mongoose.Types.ObjectId(targetId);
      } else {
        console.error('Invalid targetId:', targetId);
        return res.status(400).json({
          success: false,
          message: 'Invalid targetId format'
        });
      }
    }

    const logs = await ActivityLog.find(query)
      .populate('adminId', 'name email userType')
      .populate({
        path: 'targetId',
        select: 'name email title subject'
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await ActivityLog.countDocuments(query);

    res.json({
      success: true,
      logs,
      total,
      hasMore: total > parseInt(skip) + parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: error.message
    });
  }
};

exports.createActivityLog = async (adminId, actionType, description, options = {}) => {
  try {
    const log = new ActivityLog({
      adminId,
      actionType,
      description,
      targetType: options.targetType,
      targetId: options.targetId,
      targetModel: options.targetModel,
      metadata: options.metadata || {},
      ipAddress: options.ipAddress
    });

    await log.save();
    return log;
  } catch (error) {
    console.error('Error creating activity log:', error);
    return null;
  }
};
