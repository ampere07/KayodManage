const mongoose = require('mongoose');

/**
 * Repeat losing disputants.
 *
 * ── The gap this closes ──────────────────────────────────────────────────────
 *
 * Raising a dispute freezes a held payment until an admin rules, and until now
 * losing one cost the raiser nothing at all: `raisedBy` was archived into
 * `disputeHistory` and never counted. So either party could dispute every
 * booking they took, freeze each payout for the length of the admin SLA, and
 * face no consequence — the cheapest denial-of-service in the product.
 *
 * ── Why a rolling window and not a streak ────────────────────────────────────
 *
 * Deliberately the same shape as the two restriction triggers that already
 * exist (fee-paying cancellations, unclaimed no-show lapses): a rolling 30-day
 * count, appealable, system-imposed. Three losses in a month is a pattern.
 * Three losses across three years is a coincidence, and a lifetime counter would
 * eventually restrict every long-lived account.
 *
 * ── Why ONE loss must stay free ──────────────────────────────────────────────
 *
 * Losing a dispute is not the same as lying. A client who genuinely believed the
 * provider never arrived, and was wrong, has done nothing punishable — and a
 * product that penalises a single good-faith complaint teaches people not to
 * complain, which is far worse than the abuse being prevented. The threshold is
 * the whole safeguard, so it must never be 1.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Did this resolution go AGAINST the party who raised the dispute?
 *
 * `rebook` counts for nobody: ordering the work redone is not a finding about
 * who was telling the truth.
 */
function resolutionWentAgainstRaiser(raisedBy, resolution) {
  if (raisedBy === 'client') {
    // The provider was paid, or paid a share of a no-show the client was found
    // responsible for. Either way the client's claim did not hold.
    return resolution === 'provider_paid' || resolution === 'no_show_payout';
  }
  if (raisedBy === 'provider') {
    return resolution === 'client_refunded';
  }
  return false;
}

/**
 * The user id belonging to the party who raised the dispute on this job.
 */
function raiserUserId(job, raisedBy) {
  if (raisedBy === 'client') return job.userId || null;
  if (raisedBy === 'provider') return job.assignedToId || null;
  return null;
}

/**
 * How many disputes this user has raised AND lost in the rolling window.
 *
 * Counted from `disputeHistory`, which already records `raisedBy` and
 * `resolution` on every resolved dispute — so this needs no new state and works
 * retroactively on jobs resolved before the counter existed.
 */
async function countRecentLostDisputes(userId, raisedBy, session = null) {
  const Job = require('../models/Job');
  if (!userId) return 0;

  const since = new Date(Date.now() - THIRTY_DAYS_MS);
  const partyField = raisedBy === 'client' ? 'userId' : 'assignedToId';
  const losingResolutions =
    raisedBy === 'client' ? ['provider_paid', 'no_show_payout'] : ['client_refunded'];

  // $elemMatch so the three conditions must hold on the SAME history entry.
  // Without it a job with two unrelated disputes could satisfy them separately
  // and be counted as a loss that never happened.
  const query = Job.countDocuments({
    [partyField]: new mongoose.Types.ObjectId(String(userId)),
    'completionStatus.disputeHistory': {
      $elemMatch: {
        raisedBy,
        resolution: { $in: losingResolutions },
        resolvedAt: { $gte: since }
      }
    }
  });

  return session ? query.session(session) : query;
}

/**
 * Restrict a user who has now lost `threshold` disputes they raised inside the
 * window. Returns true only when THIS call is what flipped them, so the caller
 * notifies once rather than on every subsequent loss.
 */
async function restrictForDisputeAbuse(userId, raisedBy, threshold, session = null) {
  const User = require('../models/User');
  const limit = Number(threshold);

  // A threshold of 1 would punish a single good-faith complaint, which is the
  // opposite of what this is for. Anything under 2 disables the trigger.
  if (!Number.isFinite(limit) || limit < 2) return false;

  const lost = await countRecentLostDisputes(userId, raisedBy, session);
  if (lost < limit) return false;

  // findOneAndUpdate, NOT load-mutate-save. Two reasons, and the first one is
  // a bug this replaces:
  //
  // 1. `.save()` validates the WHOLE document, and this schema requires
  //    `name`, `email`, `phone` and `location` — none of which an
  //    app-created user reliably has (the app signs people up by phone and
  //    stores it as `phoneNumber`). So every attempt to restrict a real user
  //    threw `User validation failed: phone ... email ...`, and the
  //    restriction silently never applied. The manual enforcement path in
  //    services/userService.js never hit this because it has always used
  //    findByIdAndUpdate.
  // 2. The status check and the write are one atomic operation, so two
  //    concurrent rulings cannot both decide they were the one that flipped
  //    the account and send two notifications.
  const updated = await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(String(userId)), accountStatus: 'active' },
    {
      $set: {
        accountStatus: 'restricted',
        isRestricted: true,
        restrictionDetails: {
          type: 'restricted',
          reason: `Automated: ${lost} disputes raised and not upheld within 30 days`,
          restrictedAt: new Date(),
          // null marks this as system-imposed rather than admin-imposed,
          // matching the other automated restrictions.
          restrictedBy: null,
          appealAllowed: true
        }
      }
    },
    { new: true, session: session || null }
  );

  // Null means the account was not active, so this call did not flip it.
  return Boolean(updated);
}

module.exports = {
  THIRTY_DAYS_MS,
  resolutionWentAgainstRaiser,
  raiserUserId,
  countRecentLostDisputes,
  restrictForDisputeAbuse
};
