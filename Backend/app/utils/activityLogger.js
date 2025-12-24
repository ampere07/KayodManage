const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');

const logActivity = async (adminId, actionType, description, options = {}) => {
  try {
    console.log('📝 Logging activity:', { adminId, actionType, description });
    
    // Ensure adminId is a valid ObjectId
    let validAdminId;
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      validAdminId = adminId;
    } else {
      console.warn('⚠️  Invalid adminId provided:', adminId);
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
    console.log('✅ Activity logged successfully:', log._id);
    return log;
  } catch (error) {
    console.error('❌ Error logging activity:', error.message);
    console.error(error.stack);
    return null;
  }
};

module.exports = { logActivity };
