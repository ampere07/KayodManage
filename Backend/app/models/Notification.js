const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    // Everything the app can write, plus 'admin_action' which only the admin
    // creates. The booking, quote, credential and strike types were all
    // missing, so any admin save of one of those notifications failed on a
    // value the server produces routinely.
    enum: [
      'job_update',
      'message',
      'system',
      'job_assigned',
      'job_completed',
      'payment',
      'booking_cancelled',
      'booking_confirmed',
      'booking_reminder',
      'quote_received',
      'quote_accepted',
      'quote_rejected',
      'credential_verification',
      'cancellation_strike',
      'admin_action'
    ],
    required: true
  },
  relatedId: {
    type: Schema.Types.ObjectId
  },
  relatedModel: {
    type: String,
    enum: ['Job', 'Message', 'Conversation', 'Transaction']
  },
  read: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  data: Schema.Types.Mixed,
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', NotificationSchema, 'notifications');
