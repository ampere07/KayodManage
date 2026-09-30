const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');
const { getIO } = require('../realtime/ioRegistry');

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
    
    // Emit socket event for real-time updates
    try {
      const io = getIO();
      
      if (io) {
        const eventData = {
          logId: log._id,
          actionType: log.actionType,
          description: log.description
        };
        
        console.log('📡 Emitting activity:new event from activityLogger:', eventData);
        
        // Get the admin namespace and emit to ALL connected clients
        const adminNamespace = io.of('/admin');
        adminNamespace.emit('activity:new', eventData);
        
        console.log('✅ Socket event emitted to', adminNamespace.sockets.size, 'connected admin clients');
      } else {
        console.warn('⚠️ Socket.io instance not available');
      }
    } catch (socketError) {
      console.error('❌ Error emitting socket event:', socketError);
    }
    
    return log;
  } catch (error) {
    console.error('❌ Error logging activity:', error.message);
    console.error(error.stack);
    return null;
  }
};

module.exports = { logActivity };
