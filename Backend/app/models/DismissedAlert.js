const mongoose = require('mongoose');
const { Schema } = mongoose;

const DismissedAlertSchema = new Schema({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  alertId: {
    type: Schema.Types.ObjectId,
    ref: 'Alert',
    required: true
  },
  dismissedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

DismissedAlertSchema.index({ adminId: 1, alertId: 1 }, { unique: true });
DismissedAlertSchema.index({ adminId: 1 });
DismissedAlertSchema.index({ alertId: 1 });

module.exports = mongoose.model('DismissedAlert', DismissedAlertSchema);
