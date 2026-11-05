/**
 * Advertisement rules the admin applies: where an ad can show, its schedule,
 * and the state an admin sees it in.
 *
 * Whether an ad is in a carousel right now is decided by the Kayod app
 * (kayod/server src/utils/advertisements.js isAdShowing); `isShowingIn` here
 * is the same rule, and kayod/server's tests/utils/advertisements.test.js runs
 * both on the same cases.
 *
 * Placements are carousels in the app:
 *   client_home   — the promo carousel on the client home screen
 *   provider_home — the carousel on the provider home screen
 * An ad written before placements existed has none and shows on the client
 * home, where every ad used to.
 */
const PLACEMENTS = ['client_home', 'provider_home'];
const DEFAULT_PLACEMENT = 'client_home';

const placementsOf = (ad) =>
  Array.isArray(ad?.placements) && ad.placements.length > 0 ? ad.placements : [DEFAULT_PLACEMENT];

/** A clean placements list from a request, or an error message. */
function parsePlacements(value) {
  if (!Array.isArray(value)) return { error: 'Placements must be a list' };
  const unique = [...new Set(value.map(String))];
  if (unique.length === 0) return { error: 'Pick at least one place for the ad to show' };
  const unknown = unique.filter((p) => !PLACEMENTS.includes(p));
  if (unknown.length) return { error: `Unknown placement: ${unknown.join(', ')}` };
  // Stored in a fixed order, so an edit that only reorders the list isn't a change.
  return { value: PLACEMENTS.filter((p) => unique.includes(p)) };
}

/** null for "no limit", a Date, or an error for anything unreadable. */
function parseScheduleDate(value) {
  if (value === null || value === '' || value === undefined) return { value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'Schedule dates must be valid dates' };
  return { value: date };
}

const toTime = (value) => {
  if (value == null || value === '') return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/** An end at or before the start would never show. */
function scheduleError(startsAt, endsAt) {
  const start = toTime(startsAt);
  const end = toTime(endsAt);
  if (start !== null && end !== null && end <= start) return 'The end must be after the start';
  return null;
}

/** draft | paused | scheduled | live | ended — what the admin list calls an ad. */
function stateOf(ad, now = new Date()) {
  const status = ad?.status || (ad?.isActive ? 'published' : 'paused');
  if (status === 'draft') return 'draft';
  if (status === 'paused' || ad?.isActive === false) return 'paused';
  const at = now.getTime();
  const start = toTime(ad.startsAt);
  const end = toTime(ad.endsAt);
  if (end !== null && end <= at) return 'ended';
  if (start !== null && start > at) return 'scheduled';
  return 'live';
}

/** True when `ad` is in `placement`'s carousel at `now` (the app's rule). */
function isShowingIn(ad, placement = DEFAULT_PLACEMENT, now = new Date()) {
  if (!ad || ad.isActive === false || ad.status === 'draft') return false;
  if (!placementsOf(ad).includes(placement)) return false;
  return stateOf({ ...ad, status: 'published', isActive: true }, now) === 'live';
}

/** The Mongo filter for ads showing now in one placement. */
function showingFilter(placement = DEFAULT_PLACEMENT, now = new Date()) {
  const placementClause =
    placement === DEFAULT_PLACEMENT
      ? { $or: [{ placements: placement }, { placements: { $exists: false } }, { placements: { $size: 0 } }] }
      : { placements: placement };
  return {
    isActive: true,
    status: { $ne: 'draft' },
    $and: [
      placementClause,
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ],
  };
}

/** The Philippine calendar day (UTC+8), as the app counts events under it. */
const dayKey = (date = new Date()) =>
  new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** The last `n` day keys, oldest first, ending today. */
function lastDays(n, now = new Date()) {
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) days.push(dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  return days;
}

/**
 * One ad's performance from its daily stat rows: totals, the last `days` days
 * (zero-filled, oldest first), and the last day it was seen.
 */
function summarizeStats(rows, days = 14, now = new Date()) {
  const window = lastDays(days, now);
  const byDay = new Map(window.map((d) => [d, { day: d, views: 0, taps: 0 }]));
  let views = 0;
  let taps = 0;
  let lastSeen = null;
  for (const row of rows || []) {
    views += row.views || 0;
    taps += row.taps || 0;
    if ((row.views || row.taps) && (!lastSeen || row.day > lastSeen)) lastSeen = row.day;
    const bucket = byDay.get(row.day);
    if (bucket) {
      bucket.views += row.views || 0;
      bucket.taps += row.taps || 0;
    }
  }
  return { views, taps, lastSeen, daily: window.map((d) => byDay.get(d)) };
}

module.exports = {
  PLACEMENTS,
  DEFAULT_PLACEMENT,
  placementsOf,
  parsePlacements,
  parseScheduleDate,
  scheduleError,
  stateOf,
  isShowingIn,
  showingFilter,
  dayKey,
  lastDays,
  summarizeStats,
};
