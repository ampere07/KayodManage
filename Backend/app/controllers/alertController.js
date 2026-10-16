const Alert = require('../models/Alert');
const DismissedAlert = require('../models/DismissedAlert');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.resetAlerts = asyncHandler(async (req, res) => {
  await DismissedAlert.deleteMany({});
  
  await Alert.updateMany(
    {},
    { $unset: { dismissedBy: "" } }
  );
  
  res.json({
    success: true,
    message: 'All alerts reset successfully'
  });
}, 'Failed to reset alerts');

exports.dismissAlert = asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const mongoose = require('mongoose');
  const adminId = req.admin?.id || req.user?.id;
  
  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: 'Admin ID not found'
    });
  }
  
  if (!mongoose.Types.ObjectId.isValid(alertId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid alert ID'
    });
  }
  
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid admin ID'
    });
  }
  
  const alert = await Alert.findById(alertId);
  
  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }
  
  await DismissedAlert.findOneAndUpdate(
    { adminId, alertId },
    { adminId, alertId },
    { upsert: true, new: true }
  );
  
  res.json({
    success: true,
    message: 'Alert dismissed successfully'
  });
}, 'Failed to dismiss alert');

exports.cleanupOldAlertFields = asyncHandler(async (req, res) => {
  const result = await Alert.updateMany(
    { dismissedBy: { $exists: true } },
    { $unset: { dismissedBy: "" } }
  );
  
  res.json({
    success: true,
    message: 'Old alert fields cleaned up successfully',
    modifiedCount: result.modifiedCount
  });
}, 'Failed to cleanup old alert fields');
