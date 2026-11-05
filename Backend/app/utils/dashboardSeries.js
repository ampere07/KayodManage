/**
 * Calendar helpers for the Dashboard overview.
 *
 * Days and months are counted in the marketplace's time zone (Asia/Manila by
 * default, DASHBOARD_TZ to change it), not the server's: a server running in
 * UTC would otherwise end "today" at 8 AM in the Philippines and file
 * late-evening jobs under the next day.
 */
const DASHBOARD_TZ = process.env.DASHBOARD_TZ || 'Asia/Manila';
const DAY_MS = 864e5;

const dayKeyFormat = (timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" of a moment, in the given time zone. */
const dayKey = (date, timeZone = DASHBOARD_TZ) => dayKeyFormat(timeZone).format(date);

/** Midnight at the start of the moment's day, in the given time zone. */
const startOfDay = (date = new Date(), timeZone = DASHBOARD_TZ) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', timeZoneName: 'longOffset',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  // "GMT+08:00" → "+08:00"; plain "GMT" is UTC itself.
  const offset = parts.timeZoneName.replace('GMT', '') || '+00:00';
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00${offset}`);
};

/**
 * The last `count` day keys, oldest first, ending today. Each day is read at
 * its noon so a daylight-saving shift can never land two keys on one date.
 */
const lastDays = (count, now = new Date(), timeZone = DASHBOARD_TZ) => {
  const todayStart = startOfDay(now, timeZone).getTime();
  return Array.from({ length: count }, (_, i) => dayKey(new Date(todayStart - (count - 1 - i) * DAY_MS + DAY_MS / 2), timeZone));
};

/** The last `count` month keys ("YYYY-MM"), oldest first, ending this month. */
const lastMonths = (count, now = new Date(), timeZone = DASHBOARD_TZ) => {
  const [year, month] = dayKey(now, timeZone).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
};

/**
 * Lay grouped aggregation rows ({ _id: key, ...values }) onto a fixed list of
 * keys, so days or months with no activity read as zero instead of missing.
 */
const fillSeries = (keys, rows, fields) => {
  const byKey = new Map(rows.map((r) => [r._id, r]));
  return keys.map((key) => {
    const row = byKey.get(key) || {};
    return Object.fromEntries([['key', key], ...fields.map((f) => [f, row[f] || 0])]);
  });
};

/** Add up daily rows into months ("YYYY-MM-DD" → "YYYY-MM"). */
const rollUpMonths = (rows) => {
  const months = new Map();
  for (const row of rows) {
    const key = row._id.slice(0, 7);
    const sum = months.get(key) || { _id: key };
    for (const [field, value] of Object.entries(row)) {
      if (field !== '_id') sum[field] = (sum[field] || 0) + (value || 0);
    }
    months.set(key, sum);
  }
  return [...months.values()];
};

module.exports = { DASHBOARD_TZ, DAY_MS, dayKey, startOfDay, lastDays, lastMonths, fillSeries, rollUpMonths };
