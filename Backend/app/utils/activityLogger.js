const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');
const { getIO } = require('../realtime/ioRegistry');
const { logger } = require('./logger');

const logActivity = async (adminId, actionType, description, options = {}) => {
  try {
    // Ensure adminId is a valid ObjectId
    let validAdminId;
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      validAdminId = adminId;
    } else {
      logger.warn('Activity not recorded: invalid adminId', { adminId: String(adminId), actionType });
      return null;
    }

    const log = new ActivityLog({
      adminId: validAdminId,
      actionType,
      description,
      targetType: options.targetType,
      targetId: options.targetId,
      targetModel: options.targetModel,
      metadata: options.metadata || {},
      ipAddress: options.ipAddress
    });

    await log.save();

    // Emit socket event for real-time updates
    try {
      const io = getIO();

      if (io) {
        const eventData = {
          logId: log._id,
          actionType: log.actionType,
          description: log.description
        };

        // Get the admin namespace and emit to ALL connected clients
        const adminNamespace = io.of('/admin');
        adminNamespace.emit('activity:new', eventData);
      }
    } catch (socketError) {
      logger.error('Failed to emit activity:new', { activityLogId: String(log._id), err: socketError });
    }

    return log;
  } catch (error) {
    logger.error('Failed to record admin activity', { actionType, err: error });
    return null;
  }
};

module.exports = { logActivity };
