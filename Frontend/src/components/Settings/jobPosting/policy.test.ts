import { describe, it, expect } from 'vitest';
import {
  DEFAULTS,
  TOPIC_FIELDS,
  clientCancelFee,
  noShowPayout,
  normalize,
  pickTopic,
  platformFee,
  providerCancelFee,
  splitProviderFee,
  validateTopic,
  type Policy,
  type TopicId,
} from './policy';

/**
 * The page's worked examples use these calculators, so they must charge what
 * the Kayod app charges. The cases are the ones kayod/server's own tests pin
 * (tests/utils/platformFee.test.js, providerCancellationFee.test.js) and the
 * values the end-to-end run saw the real handlers produce.
 */

const policy = (over: Partial<Policy> = {}): Policy => ({ ...DEFAULTS, ...over });

describe('platformFee — kayod/server utils/platformFee.js', () => {
  const cases: [string, number, Partial<Policy>, boolean, number][] = [
    ['0% is the standard 20%', 1000, {}, false, 200],
    ['Premium pays 5 points less', 1000, {}, true, 150],
    ['configured percentage', 1000, { bookingFeePercentage: 12, bookingFeeMinimum: 60 }, false, 120],
    ['threshold 0: every job pays the percentage', 100, { bookingFeePercentage: 12, bookingFeeMinimum: 60 }, false, 12],
    ['at the threshold: percentage', 800, { bookingFeePercentage: 12, bookingFeeThreshold: 800, bookingFeeMinimum: 60 }, false, 96],
    ['below the threshold: flat', 400, { bookingFeePercentage: 12, bookingFeeThreshold: 800, bookingFeeMinimum: 60 }, false, 60],
    ['flat is the same for Premium', 400, { bookingFeePercentage: 12, bookingFeeThreshold: 800, bookingFeeMinimum: 60 }, true, 60],
    ['Premium on a configured rate', 1000, { bookingFeePercentage: 12, bookingFeeThreshold: 800, bookingFeeMinimum: 60 }, true, 70],
    ['flat never exceeds the price', 40, { bookingFeePercentage: 12, bookingFeeThreshold: 800, bookingFeeMinimum: 60 }, false, 40],
    ['rounding', 1234, { bookingFeePercentage: 12.5 }, false, 154],
  ];
  for (const [label, price, over, premium, expected] of cases) {
    it(label, () => {
      expect(platformFee(price, policy(over), premium)).toBe(expected);
    });
  }
});

describe('cancellation tiers — kayod/server utils/cancellationFee.js', () => {
  it('client: percentage above the trigger, flat at or below, flat is not a floor', () => {
    const p = policy({
      clientCancellationFeePercentage: 15, clientCancellationFeeMinimum: 120, clientCancellationFeeThreshold: 500,
      clientCancellationDayOfFeePercentage: 25, clientCancellationDayOfFeeMinimum: 350,
    });
    expect(clientCancelFee(2000, p, false)).toBe(300);
    expect(clientCancelFee(400, p, false)).toBe(120);
    expect(clientCancelFee(2000, p, true)).toBe(500);
    // Defaults: a ₱1,000 day-of cancellation pays 20% = ₱200, less than the ₱300 flat fee.
    expect(clientCancelFee(1000, DEFAULTS, true)).toBe(200);
  });

  it('provider: same shape on the provider settings', () => {
    expect(providerCancelFee(2000, DEFAULTS, false)).toBe(400);
    expect(providerCancelFee(300, DEFAULTS, false)).toBe(300);
    expect(providerCancelFee(301, DEFAULTS, false)).toBe(60);
    expect(providerCancelFee(200, DEFAULTS, false)).toBe(200);
    expect(providerCancelFee(2000, DEFAULTS, true)).toBe(800);
    expect(providerCancelFee(1000, policy({ providerCancellationFeeThreshold: 1500 }), false)).toBe(300);
  });

  it('splits the provider fee by the client share', () => {
    expect(splitProviderFee(400, DEFAULTS)).toEqual({ client: 200, platform: 200 });
    expect(splitProviderFee(400, policy({ providerCancellationFeeClientSharePercentage: 100 }))).toEqual({ client: 400, platform: 0 });
  });
});

describe('noShowPayout — the minimum is a floor', () => {
  it('pays the floor when the percentage comes to less, never more than the booking', () => {
    const p = policy({ noShowPayoutPercentage: 30, noShowPayoutMinimum: 400 });
    expect(noShowPayout(1000, p)).toBe(400);
    expect(noShowPayout(5000, p)).toBe(1500);
    expect(noShowPayout(200, p)).toBe(200);
  });
});

describe('topics', () => {
  it('cover every setting the app reads, and none it ignores', () => {
    const all = Object.values(TOPIC_FIELDS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(Object.keys(DEFAULTS).sort());
    for (const unused of ['jobPostDurationDays', 'requireApproval', 'allowAttachments']) {
      expect(all).not.toContain(unused);
    }
  });

  it('normalize fills what is missing and keeps what is set', () => {
    const p = normalize({ asapFee: 0, maxAttachments: 8 });
    expect(p.asapFee).toBe(0);
    expect(p.maxAttachments).toBe(8);
    expect(p.providerStrikeLimit).toBe(4);
  });

  it('a topic saves only its own fields', () => {
    expect(Object.keys(pickTopic('platform', DEFAULTS))).toEqual(['bookingFeePercentage', 'bookingFeeThreshold', 'bookingFeeMinimum']);
  });
});

describe('validateTopic', () => {
  it('passes the defaults', () => {
    for (const topic of Object.keys(TOPIC_FIELDS) as (keyof typeof TOPIC_FIELDS)[]) {
      expect(validateTopic(topic, DEFAULTS)).toBeNull();
    }
  });

  const refusals: [TopicId, Partial<Policy>, RegExp][] = [
    ['posting', { maxAttachments: 11 }, /1 to 10/],
    ['posting', { maxActiveJobsPerUser: 0 }, /at least 1/],
    ['posting', { asapFee: NaN }, /Fill in every amount/],
    ['platform', { bookingFeePercentage: 150 }, /between 0 and 100/],
    ['providerCancel', { providerCancellationFeeClientSharePercentage: 120 }, /client's share/i],
    ['providerCancel', { providerStrikeLimit: 0 }, /strike limit/],
    ['noShow', { noShowReviewReminderHours: 48 }, /before the window closes/],
    ['noShow', { disputeLossRestrictionCount: 1 }, /one lost dispute/],
    ['clientCancel', { clientCancellationFeeMinimum: -5 }, /negative/],
  ];
  for (const [topic, over, message] of refusals) {
    it(`${topic} refuses ${JSON.stringify(over)}`, () => {
      expect(validateTopic(topic, policy(over))).toMatch(message);
    });
  }

  it('only checks its own topic', () => {
    expect(validateTopic('platform', policy({ maxAttachments: 99 }))).toBeNull();
  });
});
