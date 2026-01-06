const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() { 
      return this.userType === 'admin' || this.userType === 'superadmin' || this.userType === 'finance' || this.userType === 'customer support' || this.userType === 'support';
    }
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  userType: {
    type: String,
    enum: ['client', 'provider', 'admin', 'superadmin', 'finance', 'customer support', 'support'],
    default: 'client'
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  categories: [{
    type: String,
    trim: true
  }],
  profileImage: {
    type: String,
    default: null
  },
  profileImagePublicId: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Enhanced restriction system
  accountStatus: {
    type: String,
    enum: ['active', 'restricted', 'suspended', 'banned'],
    default: 'active'
  },
  restrictionDetails: {
    type: {
      type: String,
      enum: ['restricted', 'suspended', 'banned'],
      required: function() { return this.accountStatus !== 'active'; }
    },
    reason: {
      type: String,
      required: function() { return this.accountStatus !== 'active'; }
    },
    restrictedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    restrictedAt: {
      type: Date,
      default: Date.now,
      required: function() { return this.accountStatus !== 'active'; }
    },
    suspendedUntil: {
      type: Date,
      required: function() { return this.accountStatus === 'suspended'; }
    },
    expiresAt: {
      type: Date,
      required: false
    },
    appealAllowed: {
      type: Boolean,
      default: true
    }
  },
  // Legacy field for backward compatibility
  isRestricted: {
    type: Boolean,
    default: false
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  ticketsResolved: {
    type: Number,
    default: 0,
    required: function() {
      return this.userType === 'admin' || this.userType === 'superadmin' || this.userType === 'finance' || this.userType === 'customer support' || this.userType === 'support';
    }
  },
  ticketsSubmittedResolved: {
    type: Number,
    default: 0
  },
  permissions: {
    dashboard: { type: Boolean, default: true },
    users: { type: Boolean, default: true },
    jobs: { type: Boolean, default: true },
    transactions: { type: Boolean, default: true },
    verifications: { type: Boolean, default: true },
    support: { type: Boolean, default: true },
    activity: { type: Boolean, default: true },
    flagged: { type: Boolean, default: true },
    settings: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to populate wallet data
UserSchema.virtual('wallet', {
  ref: 'Wallet',
  localField: '_id',
  foreignField: 'user',
  justOne: true
});

// Virtual to populate fee records
UserSchema.virtual('fees', {
  ref: 'FeeRecord',
  localField: '_id',
  foreignField: 'providerId'
});

// Virtual to check if user is currently restricted
UserSchema.virtual('isCurrentlyRestricted').get(function() {
  if (this.accountStatus === 'active') return false;
  if (this.accountStatus === 'suspended') {
    return new Date() < this.restrictionDetails.suspendedUntil;
  }
  return true; // banned or restricted
});

// Virtual to get restriction status display
UserSchema.virtual('restrictionStatus').get(function() {
  if (this.accountStatus === 'active') return null;
  if (this.accountStatus === 'suspended') {
    if (new Date() >= this.restrictionDetails.suspendedUntil) {
      return 'suspension_expired';
    }
    return 'suspended';
  }
  return this.accountStatus;
});

// Pre-save middleware to sync legacy isRestricted field
UserSchema.pre('save', function(next) {
  this.isRestricted = this.accountStatus !== 'active';
  next();
});

// Indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ isVerified: 1 });
UserSchema.index({ accountStatus: 1 });
UserSchema.index({ 'restrictionDetails.suspendedUntil': 1 });
UserSchema.index({ 'restrictionDetails.expiresAt': 1 });
UserSchema.index({ isOnline: 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema, 'users');