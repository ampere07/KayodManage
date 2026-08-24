/**
 * A client's lifetime "total spent" figure, admin-side.
 *
 * Mirror of kayod/server/src/utils/clientSpend.js — the same wallets collection
 * is written from both codebases, so the rule has to be identical on both
 * sides or a dispute resolved here would leave the figure the app maintains
 * out of step.
 *
 * The rule, applied at every site that settles a hold:
 *
 *   totalSpent += (money actually debited from heldBalance)
 *               − (money actually credited back to availableBalance)
 *
 * The app recognises a job's spend when completion captures the client's hold,
 * while the provider payout is still sitting in its warranty window. That is
 * the point of these call sites: an admin resolution that cancels the payout
 * has to take that recognised spend back off, or the client keeps reading a
 * charge for money that was returned to them.
 */

/**
 * Fold one hold settlement into the client's lifetime spend.
 *
 * @param {object} wallet a Wallet document; mutated in place, NOT saved — the
 *   caller saves it inside its own transaction.
 * @param {object} deltas
 * @param {number} [deltas.heldDebited=0] amount actually removed from
 *   heldBalance by this settlement, not the transaction's face value.
 * @param {number} [deltas.refunded=0] amount actually credited back to the
 *   client's availableBalance.
 * @returns {number} the resulting totalSpent.
 */
function settleClientSpend(wallet, { heldDebited = 0, refunded = 0 } = {}) {
  if (!wallet) return 0;

  const debited = Number.isFinite(heldDebited) ? Math.max(0, heldDebited) : 0;
  const returned = Number.isFinite(refunded) ? Math.max(0, refunded) : 0;

  if (!wallet.statistics) wallet.statistics = {};
  const current = Number(wallet.statistics.totalSpent) || 0;

  // Floored at zero: refunding a job whose spend predates this accounting would
  // otherwise drive the lifetime figure negative, and "-₱500 spent" is a worse
  // answer than an understated one.
  const next = Math.max(0, current + debited - returned);
  wallet.statistics.totalSpent = next;

  // `statistics` is a Mixed path on this schema, and Mongoose does not track
  // in-place mutation of Mixed — without this the write is silently dropped.
  if (typeof wallet.markModified === 'function') {
    wallet.markModified('statistics');
  }

  return next;
}

module.exports = { settleClientSpend };
