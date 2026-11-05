const test = require("node:test");
const assert = require("node:assert/strict");
const { MemoryStore } = require("express-session");

const {
  describeUserAgent,
  placeOf,
  listAdminSessions,
  presentSession,
  presentSignIn,
  noteSessionActivity,
  SEEN_EVERY_MS,
} = require("../../app/utils/adminSessions");
const { clientIp } = require("../../app/utils/clientIp");

/**
 * Settings → Management shows a superadmin where every other admin is signed
 * in: device, IP address and place. A wrong IP or a missing session there
 * hides exactly what the page is for, and a leaked session id would let the
 * viewer take over that admin's session.
 */

const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};

test("devices read as browser on system, with the right kind of device", () => {
  assert.deepEqual(describeUserAgent(UA.chromeWindows), { label: "Chrome on Windows", browser: "Chrome", os: "Windows", deviceType: "desktop" });
  assert.equal(describeUserAgent(UA.edgeWindows).label, "Edge on Windows");
  assert.deepEqual(describeUserAgent(UA.safariIphone), { label: "Safari on iOS", browser: "Safari", os: "iOS", deviceType: "mobile" });
  assert.equal(describeUserAgent(UA.chromeAndroid).label, "Chrome on Android");
  assert.equal(describeUserAgent(UA.chromeAndroid).deviceType, "mobile");
  assert.equal(describeUserAgent(UA.samsung).label, "Samsung Internet on Android");
  assert.equal(describeUserAgent(UA.firefoxMac).label, "Firefox on macOS");
  assert.equal(describeUserAgent(UA.ipad).deviceType, "tablet");
});

test("unknown clients say what they called themselves; missing ones say so", () => {
  assert.deepEqual(describeUserAgent("curl/8.4.0"), { label: "curl/8.4.0", browser: null, os: null, deviceType: "unknown" });
  assert.equal(describeUserAgent("").label, "Unknown device");
  assert.equal(describeUserAgent("Unknown").label, "Unknown device");
  assert.equal(describeUserAgent(undefined).label, "Unknown device");
});

test("places: this computer, a private network, or city and country by name", () => {
  assert.equal(placeOf("127.0.0.1").label, "This computer (local)");
  assert.equal(placeOf("::ffff:127.0.0.1").label, "This computer (local)");
  assert.equal(placeOf("::1").isLocal, true);
  assert.equal(placeOf("192.168.1.20").label, "Private network");
  assert.equal(placeOf("10.4.0.9").label, "Private network");
  assert.equal(placeOf("172.20.1.1").label, "Private network");
  const google = placeOf("8.8.8.8");
  assert.equal(google.countryCode, "US");
  assert.equal(google.country, "United States");
  assert.match(google.label, /United States$/);
  assert.equal(placeOf("").label, "Unknown location");
  assert.equal(placeOf("Unknown").label, "Unknown location");
});

const put = (store, sid, data) => new Promise((resolve, reject) => store.set(sid, data, (err) => (err ? reject(err) : resolve())));
const cookie = (msFromNow) => ({ originalMaxAge: 86400000, expires: new Date(Date.now() + msFromNow).toISOString(), httpOnly: true, path: "/" });

test("the in-memory store (local runs) lists signed-in admins only, skipping expired sessions", async () => {
  const store = new MemoryStore();
  await put(store, "sid-olivia", { cookie: cookie(60_000), isAuthenticated: true, adminId: "a1", sessionId: "sid-olivia", ipAddress: "8.8.8.8", userAgent: UA.chromeWindows });
  await put(store, "sid-anon", { cookie: cookie(60_000) });
  await put(store, "sid-old", { cookie: cookie(-60_000), isAuthenticated: true, adminId: "a2", sessionId: "sid-old" });
  const sessions = await listAdminSessions(store);
  assert.deepEqual(sessions.map((s) => s.sid), ["sid-olivia"]);
  assert.equal(sessions[0].data.adminId, "a1");
});

test("a MongoDB-style store (an array, no ids) is keyed by the id login copied into the session", async () => {
  const store = { all: (cb) => cb(null, [{ isAuthenticated: true, userId: "a3", sessionId: "sid-mongo", cookie: cookie(60_000) }, null]) };
  const sessions = await listAdminSessions(store);
  assert.deepEqual(sessions, [{ sid: "sid-mongo", data: { isAuthenticated: true, userId: "a3", sessionId: "sid-mongo", cookie: cookie(60_000) } }].map((s) => ({ ...s, data: { ...s.data, cookie: sessions[0].data.cookie } })));
  assert.deepEqual(await listAdminSessions(null), []);
});

test("a presented session never includes its session id, and marks the viewer's own", () => {
  const entry = {
    sid: "s3cr3t-session-id",
    data: {
      adminId: "a1", ipAddress: "8.8.8.8", lastIp: "8.8.4.4", userAgent: UA.safariIphone,
      signedInAt: "2026-10-19T01:00:00.000Z", lastSeenAt: "2026-10-19T03:00:00.000Z", cookie: cookie(60_000),
    },
  };
  const shown = presentSession(entry, "s3cr3t-session-id");
  assert.ok(!JSON.stringify(shown).includes("s3cr3t"), "the session id must not be sent");
  assert.equal(shown.isCurrent, true);
  assert.equal(presentSession(entry, "another").isCurrent, false);
  assert.equal(shown.device, "Safari on iOS");
  assert.equal(shown.ipAddress, "8.8.4.4", "the address it was last used from");
  assert.equal(shown.signInIp, "8.8.8.8", "and the one it signed in from, when different");
  assert.equal(shown.lastSeenAt, "2026-10-19T03:00:00.000Z");
  assert.equal(shown.id, presentSession(entry).id, "a stable key for the row");
});

test("a past sign-in reads the same way, falling back to the place written at the time", () => {
  const signIn = presentSignIn({ _id: "l1", createdAt: "2026-10-18T00:00:00.000Z", ipAddress: "::ffff:127.0.0.1", userAgent: UA.chromeWindows });
  assert.deepEqual(
    { device: signIn.device, ip: signIn.ipAddress, place: signIn.location.label },
    { device: "Chrome on Windows", ip: "127.0.0.1", place: "This computer (local)" }
  );
  assert.equal(presentSignIn({ _id: "l2", createdAt: new Date(), metadata: { location: "Manila, PH" } }).location.label, "Manila, PH");
});

test("activity is noted every few minutes, or straight away when the IP changes", () => {
  const fresh = new Date().toISOString();
  const session = { isAuthenticated: true, lastSeenAt: fresh, lastIp: "8.8.8.8" };
  noteSessionActivity({ session, ip: "8.8.8.8" });
  assert.equal(session.lastSeenAt, fresh, "no write inside the window");
  noteSessionActivity({ session, ip: "1.1.1.1" });
  assert.equal(session.lastIp, "1.1.1.1");
  const stale = { isAuthenticated: true, lastSeenAt: new Date(Date.now() - SEEN_EVERY_MS - 1000).toISOString(), lastIp: "8.8.8.8" };
  noteSessionActivity({ session: stale, ip: "8.8.8.8" });
  assert.ok(Date.now() - Date.parse(stale.lastSeenAt) < 5000);
  const anon = {};
  noteSessionActivity({ session: anon, ip: "8.8.8.8" });
  assert.deepEqual(anon, {}, "signed-out sessions are left alone");
});

test("the client IP is the one our proxy saw, never the left-most forwarded entry", () => {
  // Express fills req.ip from X-Forwarded-For through the trusted proxy only.
  const req = { ip: "203.0.113.7", headers: { "x-forwarded-for": "198.51.100.66, 203.0.113.7" } };
  assert.equal(clientIp(req), "203.0.113.7");
  assert.equal(clientIp({ ip: "::ffff:127.0.0.1" }), "127.0.0.1");
  assert.equal(clientIp({ socket: { remoteAddress: "::1" } }), "::1");
  assert.equal(clientIp({}), undefined);
});
