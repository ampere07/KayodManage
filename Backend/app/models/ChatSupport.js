const mongoose = require('mongoose');

const chatSupportSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true
  },
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
  ticketHistory: [{
    ticketNumber: {
      type: Number,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    openedAt: {
      type: Date,
      required: true
    },
    closedAt: {
      type: Date
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    messageCount: {
      type: Number,
      default: 0
    }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  assignedToName: {
    type: String,
    default: null
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  acceptedByName: {
    type: String,
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

function generateTicketId() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  const chars = [];

  for (let i = 0; i < 5; i++) {
    chars.push(letters.charAt(Math.floor(Math.random() * letters.length)));
  }

  for (let i = 0; i < 5; i++) {
    chars.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  const part1 = chars.slice(0, 5).join('');
  const part2 = chars.slice(5, 10).join('');

  return `${part1}-${part2}`;
}

chatSupportSchema.pre('save', function (next) {
  if (this.isNew && !this.ticketId) {
    try {
      this.ticketId = generateTicketId();
    } catch (error) {
      return next(new Error('Failed to generate ticketId: ' + error.message));
    }
  }

  if (this.isModified('messages') && this.messages.length > 0) {
    const lastMsg = this.messages[this.messages.length - 1];
    this.lastMessage = {
      text: lastMsg.message,
      timestamp: lastMsg.timestamp
    };
  }
  next();
});

chatSupportSchema.index({ userId: 1, createdAt: -1 });
chatSupportSchema.index({ status: 1 });

module.exports = mongoose.model('ChatSupport', chatSupportSchema);
