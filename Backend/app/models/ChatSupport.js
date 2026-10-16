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
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  jobDetailsSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null
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
      required: false,  // image-only messages have message: '' — must not fail required check
      default: '',
      trim: true
    },
    imageUrl: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    },
    // Admin-only note (e.g. dispute mediation reasoning) — never returned by
    // any user-facing endpoint, only the admin-facing ones.
    isInternal: {
      type: Boolean,
      default: false
    }
  }],
  lastMessage: {
    text: String,
    timestamp: Date
  }
}, {
  timestamps: true
});

const TICKET_ID_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TICKET_ID_DIGITS = '0123456789';

/**
 * A ticket id: five letters and five digits shuffled together, e.g. "K3QP7A19ZM".
 *
 * Shuffling matters — emitting the letters and digits in blocks would make the
 * shape of every id identical and the "random" half obvious at a glance.
 *
 * This file is duplicated across the two deployments that share the
 * 'chatsupports' collection:
 *   - kayod/server/src/models/ChatSupport.js         (users file tickets here)
 *   - KayodManage/Backend/app/models/ChatSupport.js  (admins read and close them)
 * Both MUST generate the same format. Edit one, copy to the other.
 */
function generateTicketId() {
  const chars = [];

  for (let i = 0; i < 5; i++) {
    chars.push(
      TICKET_ID_LETTERS.charAt(Math.floor(Math.random() * TICKET_ID_LETTERS.length))
    );
  }

  for (let i = 0; i < 5; i++) {
    chars.push(
      TICKET_ID_DIGITS.charAt(Math.floor(Math.random() * TICKET_ID_DIGITS.length))
    );
  }

  // Fisher-Yates.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * ticketId carries a unique index. The previous TKT-<timestamp>-<random> format
 * could not realistically collide because of the timestamp; this one is pure
 * randomness, so a duplicate is checked for before saving.
 *
 * The keyspace is C(10,5) * 26^5 * 10^5 ~= 3.0e14, so a retry should effectively
 * never happen — but a collision would surface as a failed ticket submission for
 * a user, which is not a failure worth leaving to chance.
 */
async function generateUniqueTicketId(Model, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const candidate = generateTicketId();
    if (!(await Model.exists({ ticketId: candidate }))) return candidate;
  }
  throw new Error(`no unused ticketId found after ${attempts} attempts`);
}

chatSupportSchema.pre('save', async function () {
  if (this.isNew && !this.ticketId) {
    try {
      this.ticketId = await generateUniqueTicketId(this.constructor);
    } catch (error) {
      throw new Error('Failed to generate ticketId: ' + error.message);
    }
  }

  if (this.isModified('messages') && this.messages.length > 0) {
    const lastMsg = this.messages[this.messages.length - 1];
    this.lastMessage = {
      text: lastMsg.message,
      timestamp: lastMsg.timestamp
    };
  }
});

chatSupportSchema.index({ userId: 1, createdAt: -1 });
chatSupportSchema.index({ status: 1 });
chatSupportSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
chatSupportSchema.index({ 'ticketHistory.resolvedBy': 1, createdAt: -1 });
chatSupportSchema.index({ category: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model('ChatSupport', chatSupportSchema);
