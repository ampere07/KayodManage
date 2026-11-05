import { describe, it, expect } from 'vitest';
import type { Advertisement } from '../types/configuration.types';
import { isShowingIn, nextScheduledChange, placementsOf, stateDetail, stateOf, tapRate } from './advertisements';

/**
 * The page's reading of an ad: its state now, where it shows, and the next
 * time the carousels change on their own. The server sends `state`; the page
 * recomputes it so the preview and the counters move on the minute.
 */

const NOW = new Date('2026-10-20T04:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const iso = (h: number) => new Date(NOW.getTime() + h * HOUR).toISOString();
const ad = (over: Partial<Advertisement> = {}): Advertisement => ({
  _id: Math.random().toString(16).slice(2).padEnd(24, '0'),
  type: 'offer', title: 'Promo', subtitle: '', highlight: '', ctaLabel: '', imageUrl: '', imageFileId: '', overlays: [], linkAction: '',
  status: 'published', isActive: true, order: 0, ...over,
});

describe('stateOf', () => {
  it('reads the status with the schedule', () => {
    expect(stateOf(ad(), NOW)).toBe('live');
    expect(stateOf(ad({ startsAt: iso(2) }), NOW)).toBe('scheduled');
    expect(stateOf(ad({ endsAt: iso(0) }), NOW)).toBe('ended');
    expect(stateOf(ad({ startsAt: iso(-1), endsAt: iso(1) }), NOW)).toBe('live');
    expect(stateOf(ad({ status: 'draft', isActive: false, startsAt: iso(2) }), NOW)).toBe('draft');
    expect(stateOf(ad({ status: 'paused', isActive: false }), NOW)).toBe('paused');
  });
});

describe('placements', () => {
  it('an ad from before placements shows on the client home only', () => {
    expect(placementsOf(ad())).toEqual(['client_home']);
    expect(isShowingIn(ad(), 'client_home', NOW)).toBe(true);
    expect(isShowingIn(ad(), 'provider_home', NOW)).toBe(false);
  });
  it('a provider ad shows on the provider home, while live', () => {
    const p = ad({ placements: ['provider_home'] });
    expect(isShowingIn(p, 'provider_home', NOW)).toBe(true);
    expect(isShowingIn({ ...p, startsAt: iso(1) }, 'provider_home', NOW)).toBe(false);
  });
});

describe('words', () => {
  it('says when a scheduled ad starts and when a live one ends', () => {
    expect(stateDetail(ad({ startsAt: '2026-10-25T01:00:00.000Z' }), NOW)).toMatch(/^Starts Oct 25/);
    expect(stateDetail(ad(), NOW)).toBe('Until you pause it');
    expect(stateDetail(ad({ endsAt: '2026-10-30T01:00:00.000Z' }), NOW)).toMatch(/^Until Oct 30/);
    expect(stateDetail(ad({ status: 'draft', isActive: false }), NOW)).toBe('Not published');
  });
  it('tap rate is taps per view', () => {
    expect(tapRate(0, 0)).toBe('–');
    expect(tapRate(1000, 31)).toBe('3.1%');
    expect(tapRate(10, 5)).toBe('50%');
  });
});

describe('nextScheduledChange', () => {
  it('finds the soonest start or end', () => {
    const soonEnd = ad({ title: 'Ending', endsAt: iso(3) });
    const laterStart = ad({ title: 'Starting', startsAt: iso(5) });
    const next = nextScheduledChange([laterStart, soonEnd, ad()], NOW);
    expect(next?.ad.title).toBe('Ending');
    expect(next?.kind).toBe('ends');
    expect(nextScheduledChange([ad()], NOW)).toBeNull();
  });
  it('ignores drafts and paused ads, which only an admin can start', () => {
    expect(nextScheduledChange([ad({ status: 'draft', isActive: false, startsAt: iso(1) })], NOW)).toBeNull();
  });
});
