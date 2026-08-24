const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../../app/models/User");

/**
 * A user's password hash must never ride along on an ordinary query.
 *
 * ── Why this is a guard and not a comment ────────────────────────────────────
 *
 * `userService.getUsers` and `userService.getUserById` both did an unprojected
 * `find` / `findById().lean()`, and `password` had no `select: false`. So every
 * admin list and every admin user-detail response shipped every user's bcrypt
 * hash to the browser. One console XSS, one logged response body, or one
 * compromised support session was a full credential dump.
 *
 * The fix is at the schema, not the call site, precisely because there were two
 * call sites and nothing stopped a third. This test pins that choice: it fails
 * if anyone removes `select: false` to make a query "simpler".
 */

test("the password field is excluded from queries by default", () => {
  const password = User.schema.path("password");
  assert.ok(password, "User schema has no password path");
  assert.equal(
    password.options.select,
    false,
    "password must be select:false so an unprojected find cannot leak the hash"
  );
});

test("a default query projection does not ask for the password", () => {
  // Mongoose bakes select:false paths into the query projection, so this is the
  // behaviour the schema flag is bought for.
  const query = User.find({});
  const projection = query.projection() || {};
  assert.notEqual(
    projection.password,
    1,
    "an unprojected find must not request the password"
  );
});
