const crypto = require('crypto');
const { getDetailedLocationFromIP } = require('./geolocation');
const { clientIp } = require('./clientIp');

/**
 * Where admins are signed in: their live sessions (from whichever session store
 * the app runs on) and their past sign-ins (from the audit log), described the
 * same way — device, IP address and place.
 */

/** "Chrome on Windows", with the parts, from a user-agent string. */
const describeUserAgent = (userAgent) => {
  const ua = typeof userAgent === 'string' ? userAgent : '';
  if (!ua || ua === 'Unknown') return { label: 'Unknown device', browser: null, os: null, deviceType: 'unknown' };

  // Order matters: Edge, Opera and Samsung all say "Chrome", and Chrome says "Safari".
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
      : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
          : /Chrome\/|CriOS\//.test(ua) ? 'Chrome'
            : /Safari\//.test(ua) ? 'Safari'
              : null;
  const os = /Windows/.test(ua) ? 'Windows'
    : /iPad/.test(ua) ? 'iPadOS'
      : /iPhone|iPod/.test(ua) ? 'iOS'
        : /Android/.test(ua) ? 'Android'
          : /CrOS/.test(ua) ? 'ChromeOS'
            : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
              : /Linux/.test(ua) ? 'Linux'
                : null;
  const deviceType = !browser && !os ? 'unknown'
    : /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet'
      : /Mobi|iPhone|iPod|Android/.test(ua) ? 'mobile'
        : 'desktop';
  // Not a browser we recognise (an API client, a script): show what it called itself.
  const label = browser && os ? `${browser} on ${os}` : browser || os || ua.slice(0, 60);
  return { label, browser, os, deviceType };
};

const countryNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

const isLoopback = (ip) => ip === '::1' || ip === '127.0.0.1' || ip === 'localhost';
const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip);

/** Where an IP address is: "Manila, Philippines", or why it can't be placed. */
const placeOf = (rawIp) => {
  const ip = rawIp ? String(rawIp).replace(/^::ffff:/, '') : '';
  if (!ip || ip === 'Unknown') return { label: 'Unknown location', city: null, country: null, countryCode: null, timezone: null, isLocal: false };
  if (isLoopback(ip)) return { label: 'This computer (local)', city: null, country: null, countryCode: null, timezone: null, isLocal: true };
  if (isPrivate(ip)) return { label: 'Private network', city: null, country: null, countryCode: null, timezone: null, isLocal: true };
  const geo = getDetailedLocationFromIP(ip);
  const country = geo.country ? (countryNames?.of(geo.country) || geo.country) : null;
  return {
    label: [geo.city, country].filter(Boolean).join(', ') || 'Unknown location',
    city: geo.city || null,
    country,
    countryCode: geo.country || null,
    timezone: geo.timezone || null,
    isLocal: false
  };
};

const cleanIp = (ip) => (ip && ip !== 'Unknown' ? String(ip).replace(/^::ffff:/, '') : null);

/**
 * Every signed-in admin session in the store, as { sid, data }. Works with
 * express-session's memory store (an object keyed by session id) and
 * connect-mongo (an array of sessions; the id is the one login copied in).
 * Both leave out expired sessions.
 */
const listAdminSessions = (store) => new Promise((resolve, reject) => {
  if (!store || typeof store.all !== 'function') return resolve([]);
  store.all((err, result) => {
    if (err) return reject(err);
    const entries = Array.isArray(result) ? result.map((data) => [data?.sessionId, data]) : Object.entries(result || {});
    resolve(entries
      .filter(([, data]) => data && data.isAuthenticated && (data.adminId || data.userId))
      .map(([sid, data]) => ({ sid: data.sessionId || sid, data })));
  });
});

/**
 * One session as the panel shows it. The session id itself never leaves the
 * server — it works like a password — so rows are keyed by a short hash of it.
 */
const presentSession = ({ sid, data }, currentSid) => {
  const ipAddress = cleanIp(data.lastIp || data.ipAddress);
  const signInIp = cleanIp(data.ipAddress);
  const device = describeUserAgent(data.userAgent);
  return {
    id: crypto.createHash('sha256').update(String(sid)).digest('hex').slice(0, 16),
    adminId: String(data.adminId || data.userId),
    device: device.label,
    browser: device.browser,
    os: device.os,
    deviceType: device.deviceType,
    ipAddress,
    signInIp: signInIp && signInIp !== ipAddress ? signInIp : null,
    location: placeOf(ipAddress),
    signedInAt: data.signedInAt || null,
    lastSeenAt: data.lastSeenAt || data.signedInAt || null,
    expiresAt: data.cookie?.expires ? new Date(data.cookie.expires).toISOString() : null,
    isCurrent: Boolean(currentSid && sid === currentSid)
  };
};

/** Most recently active first; sessions from before activity tracking go last. */
const byLastSeen = (a, b) => (Date.parse(b.lastSeenAt || 0) || 0) - (Date.parse(a.lastSeenAt || 0) || 0);

/** A past sign-in, from its admin_login audit entry. */
const presentSignIn = (log) => {
  const ipAddress = cleanIp(log.ipAddress);
  const device = describeUserAgent(log.userAgent);
  const place = ipAddress ? placeOf(ipAddress) : null;
  return {
    id: String(log._id),
    at: log.createdAt,
    device: device.label,
    deviceType: device.deviceType,
    ipAddress,
    // Entries from before IPs were recorded keep the place written at the time.
    location: place || { label: log.metadata?.location || 'Unknown location', isLocal: false }
  };
};

/** Session activity is written at most this often, so a busy admin doesn't write on every request. */
const SEEN_EVERY_MS = 5 * 60 * 1000;

/**
 * Note on the session when, and from where, the admin was last active. Called
 * by the auth middleware on every authenticated request; it only changes the
 * session (and so only causes a store write) every few minutes, or when the
 * IP address changes.
 */
const noteSessionActivity = (req) => {
  const session = req?.session;
  if (!session || !session.isAuthenticated) return;
  const ip = clientIp(req);
  const last = Date.parse(session.lastSeenAt || 0) || 0;
  if (Date.now() - last >= SEEN_EVERY_MS || (ip && ip !== session.lastIp)) {
    session.lastSeenAt = new Date().toISOString();
    if (ip) session.lastIp = ip;
  }
};

module.exports = {
  describeUserAgent,
  placeOf,
  listAdminSessions,
  presentSession,
  presentSignIn,
  byLastSeen,
  noteSessionActivity,
  SEEN_EVERY_MS
};
