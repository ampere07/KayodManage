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
    required: function () {
      return this.userType === 'admin' || this.userType === 'superadmin' || this.userType === 'finance' || this.userType === 'customer support' || this.userType === 'support';
    },
    // Never returned unless a query asks for it with .select("+password").
    //
    // userService.getUsers and getUserById both do an unprojected
    // find/findById().lean(), so every admin list and detail response was
    // shipping every user's bcrypt hash to the browser. One console XSS, one
    // logged response body, or one compromised support session was a full
    // credential dump. Excluding it at the schema means the leak cannot be
    // reintroduced by adding another unprojected query.
    select: false
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
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
  jobCategories: Schema.Types.Mixed,
  category: String,
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
  credentialVerificationStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected", "resubmission_requested", "flagged"],
    default: "none",
  },
  jobVerificationStatus: [
    {
      category: String,
      status: {
        type: String,
        // "expired" is written by the Kayod server's expireCertifications cron
        // when a credential lapses. Without it here, saving a provider who has
        // any lapsed credential failed validation — on exactly the documents an
        // admin reviews credentials from.
        enum: ["none", "pending", "approved", "rejected", "expired", "resubmission_requested", "flagged"],
        default: "none",
      },
      documents: [
        {
          cloudinaryUrl: String,
          publicId: String,
          uploadedAt: Date,
          originalName: String,
        },
      ],
      reviewedAt: Date,
      reviewedBy: Schema.Types.ObjectId,
      adminNotes: String,
    },
  ],
  // Enhanced restriction system
  accountStatus: {
    type: String,
    enum: ['active', 'restricted', 'suspended', 'banned', 'deleted'],
    default: 'active'
  },
  // Confirmed fault findings — what an admin ESTABLISHED, per job.
  //
  // Declared here as well as in the kayod server because Mongoose runs in strict
  // mode: an undeclared path is silently dropped on write, so a `$push` from the
  // resolve handler would appear to succeed and store nothing. This is the panel
  // that MAKES the findings, so the omission would have been total.
  //
  // Distinct from every other count on this account: a lapse means nobody spoke
  // up, a lost dispute means a complaint was not upheld, and neither is a finding
  // of fault. See app/utils/faultFinding.js.
  faultFindings: [{
    jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    role: { type: String, enum: ['client', 'provider'] },
    faultParty: { type: String, enum: ['client', 'provider', 'both'] },
    findingReason: {
      type: String,
      enum: ['no_show', 'late_cancel', 'access_failure', 'emergency', 'other'],
    },
    notes: { type: String, default: null },
    // Decided by the rules in force when the finding was made, so widening the
    // sanctionable set later cannot turn old rows into strikes retroactively.
    sanctioned: { type: Boolean, default: false },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date, default: Date.now },
  }],
  restrictionDetails: {
    type: {
      type: String,
      enum: ['restricted', 'suspended', 'banned', 'deleted'],
      required: function () { return this.accountStatus !== 'active'; }
    },
    reason: {
      type: String,
      required: function () { return this.accountStatus !== 'active'; }
    },
    restrictedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    restrictedAt: {
      type: Date,
      default: Date.now,
      required: function () { return this.accountStatus !== 'active'; }
    },
    suspendedUntil: {
      type: Date,
      required: function () { return this.accountStatus === 'suspended'; }
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
  ratings: {
    type: Number,
    default: 0,
    min: 0
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpiresAt: {
    type: Date,
    default: null
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
    required: function () {
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
  },
  // Mirrors kayod/server/src/models/User.js. Read-only here: the Kayod server
  // writes these rows, the admin only ever displays them. It has to exist on
  // this schema regardless, because getUserById() reads .lean() and Mongoose
  // strips fields the schema does not declare — without it a user's agreement
  // history would silently be absent from the admin exactly when support needs
  // it, which is during a dispute.
  legalAcceptances: [{
    version: { type: String, trim: true },
    documentIds: { type: [String], default: [] },
    context: { type: String },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    acceptedAt: { type: Date },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to populate wallet data
UserSchema.virtual('wallet', {
  ref: 'Wallet',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Virtual to populate fee records
UserSchema.virtual('fees', {
  ref: 'FeeRecord',
  localField: '_id',
  foreignField: 'providerId'
});

// Virtual to check if user is currently restricted
UserSchema.virtual('isCurrentlyRestricted').get(function () {
  if (this.accountStatus === 'active') return false;
  if (this.accountStatus === 'suspended') {
    return new Date() < this.restrictionDetails.suspendedUntil;
  }
  return true; // banned or restricted
});

// Virtual to get restriction status display
UserSchema.virtual('restrictionStatus').get(function () {
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
UserSchema.pre('save', function (next) {
  this.isRestricted = this.accountStatus !== 'active';
  next();
});

// Indexes for better query performance
UserSchema.index({ isVerified: 1 });
UserSchema.index({ accountStatus: 1 });
UserSchema.index({ 'restrictionDetails.suspendedUntil': 1 });
UserSchema.index({ 'restrictionDetails.expiresAt': 1 });
UserSchema.index({ isOnline: 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema, 'users');