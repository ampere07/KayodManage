const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parsePlacements,
  parseScheduleDate,
  scheduleError,
  stateOf,
  isShowingIn,
  dayKey,
  lastDays,
  summarizeStats,
} = require('../../app/utils/advertisementRules');

/**
 * The Advertisement page's rules: where an ad may show, its schedule, and the
 * state it's listed under. Whether it actually shows is the Kayod app's call;
 * kayod/server tests/utils/advertisements.test.js checks isShowingIn against it.
 */

const NOW = new Date('2026-10-20T04:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const at = (offsetHours) => new Date(NOW.getTime() + offsetHours * HOUR);

test('placements: a clean, ordered list of known carousels', () => {
  assert.deepEqual(parsePlacements(['provider_home', 'client_home', 'client_home']).value, ['client_home', 'provider_home']);
  assert.match(parsePlacements([]).error, /at least one/);
  assert.match(parsePlacements(['banner']).error, /Unknown placement: banner/);
  assert.match(parsePlacements('client_home').error, /list/);
});

test('schedule dates: empty means no limit, nonsense is refused', () => {
  assert.equal(parseScheduleDate('').value, null);
  assert.equal(parseScheduleDate(null).value, null);
  assert.equal(parseScheduleDate('2026-11-01T00:00:00.000Z').value.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.match(parseScheduleDate('next tuesday').error, /valid dates/);
});

test('schedule: the end must come after the start', () => {
  assert.equal(scheduleError(at(1), at(2)), null);
  assert.equal(scheduleError(null, at(2)), null);
  assert.equal(scheduleError(at(1), null), null);
  assert.match(scheduleError(at(2), at(2)), /after the start/);
  assert.match(scheduleError(at(3), at(2)), /after the start/);
});

test('state: what the admin list calls an ad', () => {
  assert.equal(stateOf({ status: 'draft', isActive: false }, NOW), 'draft');
  assert.equal(stateOf({ status: 'paused', isActive: false }, NOW), 'paused');
  assert.equal(stateOf({ isActive: false }, NOW), 'paused');
  assert.equal(stateOf({ status: 'published', isActive: true }, NOW), 'live');
  assert.equal(stateOf({ isActive: true }, NOW), 'live');
  assert.equal(stateOf({ status: 'published', isActive: true, startsAt: at(1) }, NOW), 'scheduled');
  assert.equal(stateOf({ status: 'published', isActive: true, endsAt: at(0) }, NOW), 'ended');
  assert.equal(stateOf({ status: 'published', isActive: true, startsAt: at(-2), endsAt: at(2) }, NOW), 'live');
  // A paused ad stays "paused" whatever its schedule says.
  assert.equal(stateOf({ status: 'paused', isActive: false, startsAt: at(1) }, NOW), 'paused');
});

test('showing: published, in the placement, inside the schedule', () => {
  const live = { status: 'published', isActive: true };
  assert.equal(isShowingIn(live, 'client_home', NOW), true);
  assert.equal(isShowingIn(live, 'provider_home', NOW), false);
  assert.equal(isShowingIn({ ...live, placements: ['provider_home'] }, 'provider_home', NOW), true);
  assert.equal(isShowingIn({ ...live, startsAt: at(1) }, 'client_home', NOW), false);
  assert.equal(isShowingIn({ status: 'draft', isActive: false }, 'client_home', NOW), false);
});

test('days are Philippine calendar days; the window ends today', () => {
  assert.equal(dayKey(new Date('2026-10-19T16:00:00.000Z')), '2026-10-20');
  const days = lastDays(3, NOW);
  assert.deepEqual(days, ['2026-10-18', '2026-10-19', '2026-10-20']);
});

test('stats: totals over all time, a zero-filled window, and the last day seen', () => {
  const rows = [
    { day: '2026-10-01', placement: 'client_home', views: 50, taps: 5 },
    { day: '2026-10-19', placement: 'client_home', views: 10, taps: 1 },
    { day: '2026-10-19', placement: 'provider_home', views: 4, taps: 0 },
    { day: '2026-10-20', placement: 'client_home', views: 6, taps: 2 },
  ];
  const s = summarizeStats(rows, 3, NOW);
  assert.equal(s.views, 70);
  assert.equal(s.taps, 8);
  assert.equal(s.lastSeen, '2026-10-20');
  assert.deepEqual(s.daily, [
    { day: '2026-10-18', views: 0, taps: 0 },
    { day: '2026-10-19', views: 14, taps: 1 },
    { day: '2026-10-20', views: 6, taps: 2 },
  ]);
  assert.deepEqual(summarizeStats([], 2, NOW), { views: 0, taps: 0, lastSeen: null, daily: [{ day: '2026-10-19', views: 0, taps: 0 }, { day: '2026-10-20', views: 0, taps: 0 }] });
});
