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

const {
  DEFAULT_SERVICE_CLASS,
  getPaymentReleaseHours,
} = require('../config/serviceClasses');

// Fallback for a job that somehow reaches here without a snapshotted window.
// Deliberately the longest class, not the shortest — guessing wrong should
// delay a payout, never let one out early.
const DEFAULT_RELEASE_HOURS = getPaymentReleaseHours(DEFAULT_SERVICE_CLASS);

function getReleaseHoursForJob(job) {
  const snapshot = job?.paymentReleaseHours;
  // Type check FIRST, before any coercion: `Number(null)` is 0 and would pass a
  // numeric guard, turning an explicitly-null snapshot into an instant payout.
  // A type check rejects null/undefined/strings while admitting a real 0, which
  // the `immediate` class legitimately carries. Mirrors kayod/server.
  if (typeof snapshot === 'number' && Number.isFinite(snapshot) && snapshot >= 0) {
    return snapshot;
  }
  return getPaymentReleaseHours(job?.serviceClass);
}

/**
 * When the provider gets paid, given the job's own service class.
 *
 * The hold length is per-job (see app/config/serviceClasses.js): `standard`
 * work holds 5 days as a warranty, `immediate` work holds 24 hours. The 9am
 * normalisation is kept for the multi-day windows — a payout landing at a
 * predictable hour is friendlier than one landing at 2am — but is skipped for
 * sub-48h windows, where rounding to the next 9am could nearly double a hold
 * the client was promised as "24 hours".
 */
function calculateReleaseDate(completionDate = new Date(), job = null) {
  const hours = job ? getReleaseHoursForJob(job) : DEFAULT_RELEASE_HOURS;
  const releaseDate = new Date(new Date(completionDate).getTime() + hours * 60 * 60 * 1000);
  // 9am normalisation only for multi-day holds. A zero or sub-48h window must
  // land exactly where it was calculated — rounding an instant release forward
  // to the next 9am would be a hold nobody asked for.
  if (hours >= 48) {
    releaseDate.setHours(9, 0, 0, 0);
  }
  return releaseDate;
}

async function calculatePlatformFee(amount, providerId = null) {
  let feeRate = 0.20;

  if (providerId) {
    const provider = await User.findById(providerId);
    if (provider?.isPremium && provider.premiumExpiresAt && provider.premiumExpiresAt > new Date()) {
      feeRate = 0.15;
    }
  }

  return Math.round(amount * feeRate);
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

  const releaseDate = calculateReleaseDate(jobCompletedAt, job);
  const platformFee = await calculatePlatformFee(job.escrowAmount, providerId);
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

/** The live hold for a job, if any — the record a dispute paused. */
async function findLiveEscrowRelease(jobId, session = null) {
  return EscrowRelease.findOne({
    jobId,
    status: { $in: ['scheduled', 'processing', 'failed'] }
  }).session(session || null);
}

/**
 * Resume the hold a dispute paused, for the "pay provider" outcome.
 *
 * Deliberately does NOT call scheduleEscrowRelease: that overwrites
 * scheduledFor with a fresh window, which handed a provider who WON the dispute
 * a second full warranty period on top of the one they had already served. The
 * hold is a warranty on delivered work, and the work was delivered once.
 *
 *  - original release date still in the future -> leave it exactly as it is and
 *    let kayod/server's EscrowScheduler pay out on the original date.
 *  - original release date already passed (mediation outlasted the window) ->
 *    make it due now, so the next tick pays out instead of the provider waiting
 *    again for time that has already elapsed.
 *
 * Returns null when there is no live hold — that means the dispute was raised
 * before completion, so there is no warranty already part-served and the caller
 * should schedule a first hold normally.
 */
async function resumeEscrowRelease(jobId, session = null) {
  const Job = require('../models/Job');

  const escrowRelease = await findLiveEscrowRelease(jobId, session);
  if (!escrowRelease) return null;

  const now = new Date();
  const originalScheduledFor = escrowRelease.scheduledFor;
  const isOverdue = originalScheduledFor <= now;

  escrowRelease.status = 'scheduled';
  escrowRelease.failedAt = null;
  escrowRelease.failureReason = null;
  escrowRelease.retryCount = 0;
  if (isOverdue) {
    escrowRelease.scheduledFor = now;
  }
  await escrowRelease.save({ session: session || null });

  const job = await Job.findById(jobId).session(session || null);
  if (job) {
    job.escrowReleaseAt = escrowRelease.scheduledFor;
    job.escrowStatus = 'pending';
    await job.save({ session: session || null });
  }

  return {
    escrowRelease,
    originalScheduledFor,
    scheduledFor: escrowRelease.scheduledFor,
    releasedImmediately: isOverdue
  };
}

/**
 * Pause the hold for the "rebook" outcome — the work is being redone, so the
 * money must neither pay out nor refund, and the original countdown must stop
 * rather than keep ticking toward a payout for work that is not finished.
 *
 * kayod/server's EscrowScheduler only picks up status "scheduled", so a
 * suspended record is inert. Its EscrowService.scheduleEscrowRelease reuses
 * suspended records, so when the redo is completed and confirmed the same
 * record is revived with a fresh window measured from the new completion.
 */
async function suspendEscrowRelease(jobId, reason = 'Rebook ordered by dispute resolution', session = null) {
  const escrowRelease = await findLiveEscrowRelease(jobId, session);
  if (!escrowRelease) return null;

  escrowRelease.status = 'suspended';
  escrowRelease.metadata = {
    ...(escrowRelease.metadata?.toObject?.() || escrowRelease.metadata || {}),
    suspendedAt: new Date(),
    suspendedReason: reason,
    suspendedFromScheduledFor: escrowRelease.scheduledFor
  };
  await escrowRelease.save({ session: session || null });

  return escrowRelease;
}

/**
 * The hold this job's rebooked work will get, already worded ("24 hours" /
 * "5 days"), for notification copy.
 *
 * Replaces the old exported ESCROW_DAYS constant: the hold is no longer a
 * single number, so telling every client "a new 5-day hold starts" would be
 * wrong for half the marketplace. Formatting matches the client app's
 * formatReleaseWindow — hours under 48, days above.
 */
function describeReleaseWindow(job) {
  const hours = getReleaseHoursForJob(job);
  // A zero-hour class has no window to word. Returning "0 hours" would put a
  // duration into notification copy that promises the opposite of what it says
  // ("a new 0 hours hold starts"), so callers get null and write their own
  // sentence — the same contract as formatReleaseWindow in the client app.
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 48) {
    const rounded = Math.round(hours);
    return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
  }
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

module.exports = {
  getReleaseHoursForJob,
  describeReleaseWindow,
  calculateReleaseDate,
  calculatePlatformFee,
  scheduleEscrowRelease,
  findLiveEscrowRelease,
  resumeEscrowRelease,
  suspendEscrowRelease
};
