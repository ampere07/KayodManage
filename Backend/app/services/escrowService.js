const mongoose = require('mongoose');
const User = require('../models/User');
const EscrowRelease = require('../models/EscrowRelease');

// Mirrors the scheduling half of kayod/server's EscrowService — deliberately
// only the "schedule" step, not "process/release". The actual payout is
// handled by kayod/server's existing hourly EscrowScheduler reading the same
// shared `escrowreleases` collection; recreating that processing loop here
// would be a second, divergent implementation of the same job. Scheduling
// from here is enough for anything Kayod Manage needs to do (e.g. a dispute
// resolution's "Pay Provider" outcome).

const ESCROW_DAYS = 5;

function calculateReleaseDate(completionDate = new Date()) {
  const releaseDate = new Date(completionDate);
  releaseDate.setDate(releaseDate.getDate() + ESCROW_DAYS);
  releaseDate.setHours(9, 0, 0, 0);
  return releaseDate;
}

async function calculatePlatformFee(amount, providerId = null, isUrgent = false) {
  let feeRate = 0.20;

  if (providerId) {
    const provider = await User.findById(providerId);
    if (provider?.isPremium && provider.premiumExpiresAt && provider.premiumExpiresAt > new Date()) {
      feeRate = 0.15;
    }
  }

  let fee = Math.round(amount * feeRate);
  if (isUrgent) {
    fee += 100;
  }

  return fee;
}

async function scheduleEscrowRelease(jobId, jobCompletedAt = new Date(), session = null) {
  const Job = require('../models/Job');

  const job = await Job.findById(jobId).session(session || null);
  if (!job) {
    throw new Error('Job not found');
  }

  const providerId = job.assignedToId;
  const clientId = job.userId;

  if (!providerId) {
    throw new Error('No provider assigned to job');
  }

  if (job.escrowStatus === 'released' || job.escrowStatus === 'refunded') {
    throw new Error('Escrow already processed');
  }

  const releaseDate = calculateReleaseDate(jobCompletedAt);
  const platformFee = await calculatePlatformFee(job.escrowAmount, providerId, job.isUrgent);
  const netAmount = job.escrowAmount - platformFee;

  const existingRelease = await EscrowRelease.findOne({
    jobId: job._id,
    status: { $in: ['scheduled', 'processing'] }
  }).session(session || null);

  if (existingRelease) {
    existingRelease.scheduledFor = releaseDate;
    existingRelease.escrowAmount = job.escrowAmount;
    existingRelease.platformFee = platformFee;
    existingRelease.netAmount = netAmount;
    await existingRelease.save({ session: session || null });
    return existingRelease;
  }

  const escrowRelease = await EscrowRelease.scheduleRelease(
    job._id,
    clientId,
    providerId,
    job.escrowAmount,
    platformFee,
    releaseDate,
    {
      jobTitle: job.title,
      originalBudget: job.budget,
      jobCompletedAt
    },
    session
  );

  job.escrowReleaseAt = releaseDate;
  job.escrowStatus = 'pending';
  await job.save({ session: session || null });

  return escrowRelease;
}

module.exports = {
  ESCROW_DAYS,
  calculateReleaseDate,
  calculatePlatformFee,
  scheduleEscrowRelease
};
