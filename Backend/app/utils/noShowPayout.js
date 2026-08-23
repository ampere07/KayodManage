// Reserved-time payout: what an ADJUDICATED no-show pays the wronged party.
//
// A booking whose day passed with neither side confirming enters a review
// window in the app (kayod/server autoConfirmCompletion.js Case C). If nobody
// raises an issue the booking lapses and the client is refunded in full — no
// payout, no fee, no strike, because silence from both parties is not evidence
// about either of them. This module prices the OTHER path: someone raised an
// issue, an admin looked at it, and found that the client did not appear.
//
// Same percentage/minimum shape as the day-of cancellation fee, and for the
// same reason: the provider held a slot and lost it. The two prices are meant
// to move together, so a client cancelling on the day and a client simply not
// turning up cost roughly the same — otherwise not answering the phone is
// cheaper than saying so.
//
// ── Mirrors ──────────────────────────────────────────────────────────────────
// kayod/server/src/utils/cancellationFee.js is the source of truth. Duplicated
// by hand here because the two apps share one database but not one package —
// the same arrangement as serviceClasses.js and JobCategory.js.

const DEFAULT_PAYOUT_PERCENTAGE = 20;
const DEFAULT_PAYOUT_MINIMUM = 300;

/**
 * @param {number} agreedPrice - the held amount for the booking
 * @param {object} [config] - job-posting settings (noShowPayoutPercentage /
 *   noShowPayoutMinimum). Falls back to the defaults above.
 * @returns {{ payout: number, refundAmount: number }} payout goes to the
 *   provider after the hold; refundAmount returns to the client immediately.
 */
function calculateNoShowPayout(agreedPrice, config = {}) {
  const amount = Number(agreedPrice);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { payout: 0, refundAmount: 0 };
  }

  const percentage = Number.isFinite(Number(config.noShowPayoutPercentage))
    ? Number(config.noShowPayoutPercentage)
    : DEFAULT_PAYOUT_PERCENTAGE;
  const minimum = Number.isFinite(Number(config.noShowPayoutMinimum))
    ? Number(config.noShowPayoutMinimum)
    : DEFAULT_PAYOUT_MINIMUM;

  const percentagePayout = Math.round((amount * percentage) / 100);
  // A true floor, unlike the cancellation fee's threshold model: the minimum is
  // what makes a small booking worth showing up for, so it must not be
  // undercut by a percentage of a cheap job. Capped at the held amount, since
  // a payout can never exceed the money that exists.
  const payout = Math.min(amount, Math.max(percentagePayout, minimum));

  return { payout, refundAmount: amount - payout };
}

module.exports = {
  DEFAULT_PAYOUT_PERCENTAGE,
  DEFAULT_PAYOUT_MINIMUM,
  calculateNoShowPayout,
};
