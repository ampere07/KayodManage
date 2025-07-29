const mongoose = require('mongoose');
const { Schema } = mongoose;

const WalletSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  availableBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  heldBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'PHP'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  statistics: {
    type: Schema.Types.Mixed,
    default: {}
  },
  limits: {
    type: Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
WalletSchema.index({ user: 1 });
WalletSchema.index({ isActive: 1 });
WalletSchema.index({ isVerified: 1 });

module.exports = mongoose.model('Wallet', WalletSchema, 'wallets');