const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../../app/models/User");
const { adminAuth, requireSuperAdmin } = require("../../app/middleware/auth");
const { _superadminLockoutError, _permissionChanges } = require("../../app/controllers/adminController");

/**
 * The audit log and admin management are superadmin-only on the server. Before
 * this, every route used adminAuth and trusted the role cached in the session,
 * so any admin could call POST /api/admin/admins (including to create a
 * superadmin) and a deactivated admin kept working until their cookie expired.
 */

/** Make User.findById(...).select(...) resolve to `account` for the duration of `fn`. */
async function withAccount(account, fn) {
  const original = User.findById;
  User.findById = () => ({ select: async () => account });
  try { return await fn(); } finally { User.findById = original; }
}

function call(middleware, role = "superadmin") {
  return new Promise((resolve) => {
    let destroyed = false;
    const req = {
      session: { isAuthenticated: true, role, adminId: "64b000000000000000000001", userId: "64b000000000000000000001", destroy: (cb) => { destroyed = true; cb && cb(); } },
    };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body, next: false, destroyed, req }); return this; },
    };
    middleware(req, res, () => resolve({ status: null, next: true, destroyed, req }));
  });
}

const account = (overrides) => ({ _id: { toString: () => "64b000000000000000000001" }, name: "Ana", email: "ana@kayod.test", userType: "superadmin", accountStatus: "active", ...overrides });

test("an active superadmin is let through", async () => {
  const result = await withAccount(account(), () => call(requireSuperAdmin));
  assert.equal(result.next, true);
});

test("a regular admin is refused with 403", async () => {
  const result = await withAccount(account({ userType: "admin" }), () => call(requireSuperAdmin, "admin"));
  assert.equal(result.status, 403);
  assert.equal(result.next, false);
});

test("a demoted superadmin is refused even though the session still says superadmin", async () => {
  const result = await withAccount(account({ userType: "admin" }), () => call(requireSuperAdmin, "superadmin"));
  assert.equal(result.status, 403);
  assert.equal(result.req.session.role, "admin", "the session role follows the account");
});

test("a deactivated admin's session is ended on their next request", async () => {
  const result = await withAccount(account({ userType: "admin", accountStatus: "suspended" }), () => call(adminAuth, "admin"));
  assert.equal(result.status, 401);
  assert.equal(result.destroyed, true);
});

test("a deleted admin account ends the session", async () => {
  const result = await withAccount(null, () => call(adminAuth, "admin"));
  assert.equal(result.status, 401);
  assert.equal(result.destroyed, true);
});

/** Run the lockout rule with `others` other active superadmins in the database. */
async function lockout({ target, actorId, nextRole, nextStatus, others = 1 }) {
  const original = User.countDocuments;
  User.countDocuments = async () => others;
  try {
    return await _superadminLockoutError({ admin: { id: actorId } }, target, nextRole, nextStatus);
  } finally { User.countDocuments = original; }
}

const superadmin = { _id: "64b000000000000000000002", userType: "superadmin", accountStatus: "active" };

test("a superadmin cannot remove their own superadmin access or deactivate themselves", async () => {
  assert.match(await lockout({ target: superadmin, actorId: superadmin._id, nextRole: "admin", nextStatus: "active" }), /own superadmin access/);
  assert.match(await lockout({ target: superadmin, actorId: superadmin._id, nextRole: "superadmin", nextStatus: "suspended" }), /deactivate your own account/);
});

test("the last active superadmin cannot be demoted by anyone", async () => {
  assert.match(await lockout({ target: superadmin, actorId: "other", nextRole: "admin", nextStatus: "active", others: 0 }), /at least one active superadmin/);
  assert.equal(await lockout({ target: superadmin, actorId: "other", nextRole: "admin", nextStatus: "active", others: 1 }), null);
});

test("edits that keep a superadmin active, and edits to other admins, pass", async () => {
  assert.equal(await lockout({ target: superadmin, actorId: superadmin._id, nextRole: "superadmin", nextStatus: "active", others: 0 }), null);
  assert.equal(await lockout({ target: { ...superadmin, userType: "admin" }, actorId: superadmin._id, nextRole: "admin", nextStatus: "banned", others: 0 }), null);
});

test("permission changes list what was granted and revoked", () => {
  assert.deepEqual(
    _permissionChanges({ users: true, jobs: false, settings: false }, { users: false, jobs: true, settings: false }),
    { granted: ["jobs"], revoked: ["users"] }
  );
});
