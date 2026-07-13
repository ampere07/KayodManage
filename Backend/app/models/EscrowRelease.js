const mongoose = require('mongoose');
const { Schema } = mongoose;

// Mirrors kayod/server/src/models/EscrowRelease.js exactly — same shared
// collection (default pluralization: "escrowreleases"), same shape, so
// records created here are picked up and processed by kayod/server's
// existing hourly EscrowScheduler without any cross-app call needed.
const EscrowReleaseSchema = new Schema(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    escrowAmount: {
      type: Number,
      required: true,
      min: 0
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['scheduled', 'processing', 'released', 'failed', 'cancelled', 'refunded'],
      default: 'scheduled',
      index: true
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true
    },
    releasedAt: {
      type: Date,
      default: null
    },
    failedAt: {
      type: Date,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    },
    refundTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    },
    processedBy: {
      type: String,
      enum: ['system', 'manual', 'webhook', 'api'],
      default: 'system'
    },
    metadata: {
      jobTitle: String,
      originalBudget: Number,
      jobCompletedAt: Date,
      attempts: {
        type: Number,
        default: 0
      },
      lastAttemptAt: Date,
      bankCode: String,
      notes: String
    },
    retryCount: {
      type: Number,
      default: 0,
      max: 3
    },
    lastRetryAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

EscrowReleaseSchema.index({ status: 1, scheduledFor: 1 });
EscrowReleaseSchema.index({ providerId: 1, status: 1 });
EscrowReleaseSchema.index({ clientId: 1, status: 1 });

EscrowReleaseSchema.statics.scheduleRelease = async function (
  jobId,
  clientId,
  providerId,
  escrowAmount,
  platformFee,
  scheduledFor,
  metadata = {},
  session = null
) {
  const netAmount = escrowAmount - platformFee;

  const release = new this({
    jobId,
    clientId,
    providerId,
    escrowAmount,
    platformFee,
    netAmount,
    status: 'scheduled',
    scheduledFor,
    metadata: {
      ...metadata,
      attempts: 0
    }
  });

  await release.save({ session: session || null });
  return release;
};

EscrowReleaseSchema.statics.findByJobId = function (jobId) {
  return this.findOne({ jobId }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('EscrowRelease', EscrowReleaseSchema, 'escrowreleases');
