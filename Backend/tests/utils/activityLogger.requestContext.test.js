const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

// logActivity emits a socket event through require('../../server'). Loading the
// real server.js here would boot the whole app — connect to the database in .env
// and start its schedulers — so a stub stands in for it.
const serverPath = path.resolve(__dirname, "..", "..", "server.js");
const serverStub = new Module(serverPath);
serverStub.filename = serverPath;
serverStub.loaded = true;
serverStub.exports = { io: null };
require.cache[serverPath] = serverStub;

const ActivityLog = require("../../app/models/ActivityLog");
const { logActivity } = require("../../app/utils/activityLogger");
const { requestContext } = require("../../app/utils/requestContext");

/**
 * The Audit Log's entry panel shows where an action came from (IP, location,
 * browser). Most call sites only pass an admin id, so the logger takes those from
 * the request being handled. If that link breaks, every ban, refund and dispute
 * ruling silently loses its "from" line.
 */

const ADMIN = "64b000000000000000000001";

async function withStubbedSave(fn) {
  const original = ActivityLog.prototype.save;
  ActivityLog.prototype.save = async function () { return this; };
  const { error } = console;
  try { return await fn(); } finally { ActivityLog.prototype.save = original; console.error = error; }
}

const inRequest = (req, fn) => new Promise((resolve, reject) => {
  requestContext(req, {}, () => fn().then(resolve, reject));
});

test("a log written during a request records that request's IP and browser", async () => {
  const log = await withStubbedSave(() =>
    inRequest(
      { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0" } },
      () => logActivity(ADMIN, "user_banned", "Banned user X")
    )
  );
  assert.equal(log.ipAddress, "203.0.113.7");
  assert.match(log.userAgent, /Chrome/);
});

test("values the caller passes win over the request's", async () => {
  const log = await withStubbedSave(() =>
    inRequest({ headers: { "user-agent": "from-request" }, ip: "10.0.0.2" }, () =>
      logActivity(ADMIN, "user_banned", "Banned user X", { ipAddress: "198.51.100.4", userAgent: "from-caller" })
    )
  );
  assert.equal(log.ipAddress, "198.51.100.4");
  assert.equal(log.userAgent, "from-caller");
});

test("outside a request (schedulers) the fields are simply absent", async () => {
  const log = await withStubbedSave(() => logActivity(ADMIN, "bulk_transaction_approval", "Auto-approved 3 top-ups"));
  assert.equal(log.ipAddress, undefined);
  assert.equal(log.userAgent, undefined);
});
