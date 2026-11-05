import type { JobPostingSettings } from '../../../types/configuration.types';

/**
 * Settings → Configuration → Job Posting, as topics.
 *
 * Every setting the Kayod app reads belongs to exactly one topic, and each
 * topic is edited in its own panel and saved on its own (the API takes partial
 * updates). The settings the app never reads — post duration, require
 * approval, allow attachments — belong to none and are not offered.
 *
 * The calculators below mirror the app's own rules so the page can show worked
 * examples. The app is the source of truth:
 *   platform fee      kayod/server utils/platformFee.js (+ Backend/app/utils/platformFee.js)
 *   cancellation fees kayod/server utils/cancellationFee.js
 *   no-show payout    kayod/server utils/cancellationFee.js calculateNoShowPayout
 */
export const TOPIC_FIELDS = {
  posting: ['maxActiveJobsPerUser', 'maxAttachments', 'asapFee'],
  platform: ['bookingFeePercentage', 'bookingFeeThreshold', 'bookingFeeMinimum'],
  clientCancel: [
    'clientCancellationFeePercentage',
    'clientCancellationFeeMinimum',
    'clientCancellationDayOfFeePercentage',
    'clientCancellationDayOfFeeMinimum',
    'clientCancellationFeeThreshold',
  ],
  providerCancel: [
    'providerCancellationFeePercentage',
    'providerCancellationFeeMinimum',
    'providerCancellationDayOfFeePercentage',
    'providerCancellationDayOfFeeMinimum',
    'providerCancellationFeeThreshold',
    'providerCancellationFeeClientSharePercentage',
    'providerStrikeLimit',
    'providerStrikeRatingPenalty',
  ],
  noShow: [
    'noShowReviewWindowHours',
    'noShowReviewReminderHours',
    'noShowPayoutPercentage',
    'noShowPayoutMinimum',
    'noShowPayoutHoldHours',
    'noShowLapseRestrictionCount',
    'confirmedFaultRestrictionCount',
    'disputeLossRestrictionCount',
  ],
} as const;

export type TopicId = keyof typeof TOPIC_FIELDS;
export type PolicyField = (typeof TOPIC_FIELDS)[TopicId][number];
export type Policy = Pick<JobPostingSettings, PolicyField>;

export const TOPIC_ORDER: TopicId[] = ['posting', 'platform', 'clientCancel', 'providerCancel', 'noShow'];

/** What the backend schema creates a settings document with. */
export const DEFAULTS: Policy = {
  maxActiveJobsPerUser: 5,
  maxAttachments: 5,
  asapFee: 100,
  bookingFeePercentage: 0,
  bookingFeeThreshold: 0,
  bookingFeeMinimum: 0,
  clientCancellationFeePercentage: 10,
  clientCancellationFeeMinimum: 150,
  clientCancellationDayOfFeePercentage: 20,
  clientCancellationDayOfFeeMinimum: 300,
  clientCancellationFeeThreshold: 0,
  providerCancellationFeePercentage: 20,
  providerCancellationFeeMinimum: 300,
  providerCancellationDayOfFeePercentage: 40,
  providerCancellationDayOfFeeMinimum: 600,
  providerCancellationFeeThreshold: 0,
  providerCancellationFeeClientSharePercentage: 50,
  providerStrikeLimit: 4,
  providerStrikeRatingPenalty: 0,
  noShowReviewWindowHours: 48,
  noShowReviewReminderHours: 24,
  noShowPayoutPercentage: 20,
  noShowPayoutMinimum: 300,
  noShowPayoutHoldHours: 0,
  noShowLapseRestrictionCount: 3,
  confirmedFaultRestrictionCount: 2,
  disputeLossRestrictionCount: 3,
};

export const normalize = (s?: Partial<JobPostingSettings> | null): Policy => {
  const out = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as PolicyField[]) {
    const value = s?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
};

export const pickTopic = (topic: TopicId, p: Policy): Partial<Policy> =>
  Object.fromEntries(TOPIC_FIELDS[topic].map((k) => [k, p[k]])) as Partial<Policy>;

export const topicChanged = (topic: TopicId, a: Policy, b: Policy) =>
  TOPIC_FIELDS[topic].some((k) => !Object.is(a[k], b[k]));

const PERCENT_FIELDS: Partial<Record<PolicyField, string>> = {
  bookingFeePercentage: 'The platform fee percentage',
  clientCancellationFeePercentage: 'The before-the-day percentage',
  clientCancellationDayOfFeePercentage: 'The on-the-day percentage',
  providerCancellationFeePercentage: 'The before-the-day percentage',
  providerCancellationDayOfFeePercentage: 'The on-the-day percentage',
  providerCancellationFeeClientSharePercentage: "The client's share",
  noShowPayoutPercentage: "The provider's share",
};

/** The first thing wrong with a topic's values, in plain words; null when it can be saved. */
export function validateTopic(topic: TopicId, p: Policy): string | null {
  const fields = TOPIC_FIELDS[topic] as readonly PolicyField[];
  if (fields.some((k) => !Number.isFinite(p[k]))) return 'Fill in every amount.';
  if (fields.some((k) => p[k] < 0)) return 'Amounts cannot be negative.';
  for (const k of fields) {
    const label = PERCENT_FIELDS[k];
    if (label && p[k] > 100) return `${label} must be between 0 and 100%.`;
  }
  switch (topic) {
    case 'posting':
      if (!Number.isInteger(p.maxActiveJobsPerUser) || p.maxActiveJobsPerUser < 1) return 'Active jobs per client must be a whole number, at least 1.';
      if (!Number.isInteger(p.maxAttachments) || p.maxAttachments < 1 || p.maxAttachments > 10) return 'Photos and videos per post must be a whole number from 1 to 10.';
      return null;
    case 'providerCancel':
      if (!Number.isInteger(p.providerStrikeLimit) || p.providerStrikeLimit < 1) return 'The strike limit must be a whole number, at least 1.';
      return null;
    case 'noShow':
      if (p.noShowReviewWindowHours < 1) return 'The review window must be at least 1 hour.';
      // Same rule the API enforces: a reminder at or after the deadline never sends.
      if (p.noShowReviewReminderHours >= p.noShowReviewWindowHours) return 'The reminder must come before the window closes, or it never sends.';
      if (p.noShowLapseRestrictionCount < 1) return 'Missed bookings before restriction must be at least 1.';
      // One lost dispute is not abuse; restricting on it punishes a good-faith complaint.
      if (p.disputeLossRestrictionCount === 1) return 'Lost disputes must be 0 (off) or at least 2 — one lost dispute is not abuse.';
      return null;
    default:
      return null;
  }
}

// ── The app's rules, for worked examples ─────────────────────────────────────

export const STANDARD_PLATFORM_RATE = 20;
export const PREMIUM_DISCOUNT = 5;

/** The percentage the platform takes: 0 means "not set", so the standard rate. */
export const platformRate = (p: Pick<Policy, 'bookingFeePercentage'>, premium = false) =>
  Math.max(0, (p.bookingFeePercentage > 0 ? p.bookingFeePercentage : STANDARD_PLATFORM_RATE) - (premium ? PREMIUM_DISCOUNT : 0));

export function platformFee(price: number, p: Pick<Policy, 'bookingFeePercentage' | 'bookingFeeThreshold' | 'bookingFeeMinimum'>, premium = false): number {
  if (!(price > 0)) return 0;
  if (p.bookingFeeThreshold > 0 && price < p.bookingFeeThreshold) return Math.min(price, Math.max(0, p.bookingFeeMinimum));
  return Math.min(price, Math.round(price * (platformRate(p, premium) / 100)));
}

/**
 * One cancellation tier: the percentage above the trigger, the flat fee at or
 * below it (never more than the price). The trigger defaults to the flat fee.
 * The flat fee is NOT a floor — above the trigger a smaller percentage wins.
 */
export function tierFee(price: number, percentage: number, flat: number, threshold: number): number {
  if (!(price > 0)) return 0;
  const trigger = threshold > 0 ? threshold : flat;
  return Math.min(price, price > trigger ? Math.round(price * (percentage / 100)) : flat);
}

export const flatUpTo = (flat: number, threshold: number) => (threshold > 0 ? threshold : flat);

export const clientCancelFee = (price: number, p: Policy, dayOf: boolean) =>
  dayOf
    ? tierFee(price, p.clientCancellationDayOfFeePercentage, p.clientCancellationDayOfFeeMinimum, p.clientCancellationFeeThreshold)
    : tierFee(price, p.clientCancellationFeePercentage, p.clientCancellationFeeMinimum, p.clientCancellationFeeThreshold);

export const providerCancelFee = (price: number, p: Policy, dayOf: boolean) =>
  dayOf
    ? tierFee(price, p.providerCancellationDayOfFeePercentage, p.providerCancellationDayOfFeeMinimum, p.providerCancellationFeeThreshold)
    : tierFee(price, p.providerCancellationFeePercentage, p.providerCancellationFeeMinimum, p.providerCancellationFeeThreshold);

/** The client's part of a provider's fee (of what was collected), and the platform's. */
export const splitProviderFee = (fee: number, p: Policy) => {
  const client = Math.round((fee * Math.min(100, p.providerCancellationFeeClientSharePercentage)) / 100);
  return { client, platform: fee - client };
};

export const providerFeeIsOff = (p: Policy) =>
  p.providerCancellationFeePercentage === 0 && p.providerCancellationFeeMinimum === 0 &&
  p.providerCancellationDayOfFeePercentage === 0 && p.providerCancellationDayOfFeeMinimum === 0;

/** The reserved-time payout: unlike the cancellation flat fees, its minimum IS a floor. */
export function noShowPayout(price: number, p: Policy): number {
  if (!(price > 0)) return 0;
  return Math.min(price, Math.max(Math.round(price * (p.noShowPayoutPercentage / 100)), p.noShowPayoutMinimum));
}

/** The app's escalating default when no fixed penalty is set (jobController cancelBooking). */
export const ratingPenaltyText = (p: Policy) =>
  p.providerStrikeRatingPenalty > 0
    ? `−${p.providerStrikeRatingPenalty}★ per strike`
    : '−0.3★, −0.5★, −0.7★, then −0.5★ each';

// ── Words ─────────────────────────────────────────────────────────────────────

export const peso = (n: number) => `₱${(Number.isFinite(n) ? n : 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const hours = (h: number) => plural(h, 'hour');

/** "3 missed bookings · 2 confirmed no-shows · lost disputes off" */
export const restrictionCounts = (p: Policy) => ({
  missed: plural(p.noShowLapseRestrictionCount, 'missed booking'),
  confirmed: p.confirmedFaultRestrictionCount > 0 ? plural(p.confirmedFaultRestrictionCount, 'confirmed no-show') : 'Confirmed no-shows: off',
  disputes: p.disputeLossRestrictionCount > 0 ? plural(p.disputeLossRestrictionCount, 'lost dispute') : 'Lost disputes: off',
});
