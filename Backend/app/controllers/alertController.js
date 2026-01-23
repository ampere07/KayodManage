const Alert = require('../models/Alert');
const DismissedAlert = require('../models/DismissedAlert');

exports.resetAlerts = async (req, res) => {
  try {
    await DismissedAlert.deleteMany({});
    
    await Alert.updateMany(
      {},
      { $unset: { dismissedBy: "" } }
    );
    
    res.json({
      success: true,
      message: 'All alerts reset successfully'
    });
  } catch (error) {
    console.error('Error resetting alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset alerts',
      error: error.message
    });
  }
};

exports.dismissAlert = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss alert',
      error: error.message
    });
  }
};

exports.cleanupOldAlertFields = async (req, res) => {
  try {
    const result = await Alert.updateMany(
      { dismissedBy: { $exists: true } },
      { $unset: { dismissedBy: "" } }
    );
    
    res.json({
      success: true,
      message: 'Old alert fields cleaned up successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error cleaning up old alert fields:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup old alert fields',
      error: error.message
    });
  }
};
