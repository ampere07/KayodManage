const mongoose = require('mongoose');

const chatSupportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['account', 'payment', 'technical', 'job', 'general', 'feedback']
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  acceptedAt: {
    type: Date,
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['resolved', 'reopened'],
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    performedByName: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String
    }
  }],
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    senderType: {
      type: String,
      required: true,
      enum: ['User', 'Admin']
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  lastMessage: {
    text: String,
    timestamp: Date
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

chatSupportSchema.index({ userId: 1, createdAt: -1 });
chatSupportSchema.index({ status: 1 });

chatSupportSchema.pre('save', function(next) {
  if (this.isModified('messages') && this.messages.length > 0) {
    const lastMsg = this.messages[this.messages.length - 1];
    this.lastMessage = {
      text: lastMsg.message,
      timestamp: lastMsg.timestamp
    };
  }
  next();
});

module.exports = mongoose.model('ChatSupport', chatSupportSchema);
