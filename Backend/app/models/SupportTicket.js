const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true
  },
  userId: {
    type: String, // Changed to String to accommodate external user IDs
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    required: true,
    default: 'User'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['account', 'payment', 'technical', 'job', 'general', 'bug_report']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'in_progress', 'resolved', 'closed'],
    default: 'pending'
  },
  assignedAdmin: {
    type: String,  // Changed to String to support admin IDs
    default: null
  },
  assignedAdminName: {
    type: String,
    default: null
  },
  messages: [{
    senderId: String,
    senderName: String,
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
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  resolution: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    trim: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique ticket ID before validation
supportTicketSchema.pre('validate', async function(next) {
  if (!this.ticketId) {
    const count = await this.constructor.countDocuments();
    this.ticketId = `TICK-${Date.now()}-${count + 1}`;
  }
  next();
});

// Update timestamps
supportTicketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Update last activity when messages are added
supportTicketSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastActivity = new Date();
  }
  next();
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
