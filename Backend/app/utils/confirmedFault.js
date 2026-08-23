const mongoose = require('mongoose');
const {
  partiesAtFault,
  isSanctionable,
  buildFaultRow,
  countRecentFaultFindings,
  describeFinding,
} = require('./faultFinding');

/**
 * Writing an admin's finding onto the party it is against, and acting on it.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * A proven no-show moved money and left no trace. `no_show_payout` only ever
 * happens because an admin concluded the CLIENT did not appear, and
 * `client_refunded` on an open no-show review only because they concluded the
 * PROVIDER did not — but neither wrote down that conclusion anywhere reusable. So
 * the provider got paid and the client walked away with a clean record, and the
 * next admin to look at that client saw nothing.
 *
 * Everything that DID restrict accounts keyed off something else entirely:
 * ambiguous silent lapses, provider-initiated cancellations, and disputes the
 * raiser lost. None of those is a finding of fault. This is.
 *
 * ── Why `$push` and not `.save()` ────────────────────────────────────────────
 *
 * Load-mutate-save is a trap on this collection. `.save()` validates the WHOLE
 * document, and the User schema requires `name`, `email`, `phone` and `location`
 * — none of which an app-created account reliably has (the app signs people up by
 * phone and stores it as `phoneNumber`). Every attempt therefore throws
 * `User validation failed`, and the write silently never lands. That exact bug
 * disabled the dispute-abuse restriction in production; see disputeAbuse.js.
 *
 * So findings are pushed with an atomic update, and idempotency is a condition on
 * the query rather than a scan of an array held in memory.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** The user on a given side of this job. */
function partyUserId(job, role) {
  if (role === 'client') return job?.userId || null;
  if (role === 'provider') return job?.assignedToId || null;
  return null;
}

/**
 * Record the finding against every party it names.
 *
 * @param {object} job the job being ruled on
 * @param {object} finding already normalised
 * @param {object} opts
 * @param {string} [opts.adminId]
 * @param {object} [opts.session] the resolving transaction
 * @param {Date} [opts.decidedAt]
 * @returns {Promise<Array<{role: string, userId: string, sanctioned: boolean}>>}
 *   one entry per party actually recorded; empty when the finding names nobody
 */
async function recordFaultFindings(job, finding, { adminId = null, session = null, decidedAt = null } = {}) {
  const User = require('../models/User');
  const roles = partiesAtFault(finding);
  if (roles.length === 0) return [];

  const jobId = job?._id;
  if (!jobId) return [];

  const recorded = [];

  for (const role of roles) {
    const userId = partyUserId(job, role);
    if (!userId) continue;

    const row = buildFaultRow({
      jobId,
      role,
      finding,
      decidedBy: adminId && mongoose.Types.ObjectId.isValid(String(adminId)) ? adminId : null,
      decidedAt: decidedAt || new Date(),
    });
    if (!row) continue;

    // `$ne` on the pair, not just the job: a job can produce a finding against
    // BOTH parties, and each is its own row. Re-running the same ruling — a retry,
    // or a second admin closing the same case — must not double-count.
    const updated = await User.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(String(userId)),
        faultFindings: { $not: { $elemMatch: { jobId: new mongoose.Types.ObjectId(String(jobId)), role } } },
      },
      { $push: { faultFindings: row } },
      { new: true, session: session || null },
    );

    if (updated) {
      recorded.push({ role, userId: String(userId), sanctioned: row.sanctioned });
    }
  }

  return recorded;
}

/**
 * Restrict an account that has reached the confirmed-fault threshold.
 *
 * Counts only rows already marked `sanctioned` — an emergency absence is real
 * history and is deliberately excluded from the count while staying on the record.
 *
 * @param {string} userId
 * @param {"client"|"provider"} role
 * @param {number} threshold 0 disables the trigger entirely
 * @param {object} [session]
 * @returns {Promise<boolean>} true only when THIS call flipped the account
 */
async function restrictForConfirmedFault(userId, role, threshold, session = null) {
  const User = require('../models/User');
  const limit = Number(threshold);

  // 0 (or an unreadable value) means "record findings, never auto-restrict" —
  // a coherent policy while an operator builds confidence in the rulings.
  if (!Number.isFinite(limit) || limit < 1) return false;
  if (!userId) return false;

  // Only the findings array is needed, so only it is fetched. Counting in memory
  // through the shared helper keeps the `sanctioned` rule in exactly one place
  // rather than restating it as a Mongo predicate that could drift from it.
  const user = await User.findById(new mongoose.Types.ObjectId(String(userId)))
    .select('faultFindings')
    .session(session || null)
    .lean();

  const count = countRecentFaultFindings(user, { role, sinceDays: 30 });
  if (count < limit) return false;

  // findOneAndUpdate for the two reasons documented in disputeAbuse.js: `.save()`
  // throws on this schema, and the status check plus the write must be one atomic
  // operation so two concurrent rulings cannot both decide they were the one that
  // flipped the account and send two notifications.
  const updated = await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(String(userId)), accountStatus: 'active' },
    {
      $set: {
        accountStatus: 'restricted',
        isRestricted: true,
        restrictionDetails: {
          type: 'restricted',
          reason: `Automated: ${count} confirmed no-show findings within 30 days`,
          restrictedAt: new Date(),
          // null marks this as system-imposed rather than admin-imposed, matching
          // the other automated restrictions.
          restrictedBy: null,
          appealAllowed: true,
        },
      },
    },
    { new: true, session: session || null },
  );

  return Boolean(updated);
}

module.exports = {
  THIRTY_DAYS_MS,
  partyUserId,
  recordFaultFindings,
  restrictForConfirmedFault,
  // Re-exported so the resolve handler has one import for the whole concern.
  isSanctionable,
  describeFinding,
};
