/**
 * The platform's cut of a job, taken from the provider's payout when the held
 * payment is released. Configured on Settings → Configuration → Job Posting →
 * Booking Fee, which states these same rules:
 *
 *   - price at or above the threshold -> the percentage (threshold 0: every job)
 *   - price below the threshold       -> the flat minimum
 *   - never more than the price itself
 *
 * A percentage of 0 means "not set", and the standard 20% applies — the rate
 * the app charged before the setting existed. Premium providers pay 5 points
 * less on the percentage; the flat fee is the same for everyone.
 *
 * A copy of kayod/server/src/utils/platformFee.js, which schedules most
 * releases; escrowService uses this one for the releases an admin schedules.
 * kayod/server's tests/utils/platformFee.test.js runs both on the same cases.
 */
const STANDARD_RATE = 20;
const PREMIUM_DISCOUNT = 5;

const nonNegative = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

function calculatePlatformFee(amount, config, { isPremium = false } = {}) {
  const price = Number(amount);
  if (!Number.isFinite(price) || price <= 0) return 0;

  const percentage = nonNegative(config?.bookingFeePercentage) || STANDARD_RATE;
  const threshold = nonNegative(config?.bookingFeeThreshold);

  if (price < threshold) {
    return Math.min(price, nonNegative(config?.bookingFeeMinimum));
  }

  const rate = Math.max(0, percentage - (isPremium ? PREMIUM_DISCOUNT : 0)) / 100;
  return Math.min(price, Math.max(0, Math.round(price * rate)));
}

module.exports = { STANDARD_RATE, PREMIUM_DISCOUNT, calculatePlatformFee };
