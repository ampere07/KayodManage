const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  cloudinaryUrl: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  originalName: String,
  type: String
}, { _id: false });

const credentialVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  faceVerification: {
    type: [documentSchema],
    required: true
  },
  validId: {
    type: [documentSchema],
    required: true
  },
  credentials: {
    type: [documentSchema],
    default: []
  },
  status: {
    type: String,
    enum: ['approved', 'rejected', 'under_review'],
    default: 'under_review',
    index: true
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNotes: String,
  rejectionReason: String,
  verificationAttempts: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

credentialVerificationSchema.index({ userId: 1, status: 1 });
credentialVerificationSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('CredentialVerification', credentialVerificationSchema, 'credentialverifications');
