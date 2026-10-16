const test = require("node:test");
const assert = require("node:assert/strict");

const { diffFields, describeChanges, fieldLabel } = require("../../app/utils/activityLogger");

/**
 * Settings, admin and ad edits record each changed value's before and after.
 * A diff that misses a change (or invents one) makes the audit row wrong in
 * exactly the place a superadmin goes to answer "who changed the fee?".
 */

test("only changed fields are reported, with before and after", () => {
  const before = { bookingFeePercentage: 5, asapFee: 50, requireApproval: false };
  const after = { bookingFeePercentage: 7, asapFee: 50, requireApproval: true };
  assert.deepEqual(diffFields(before, after, ["bookingFeePercentage", "asapFee", "requireApproval"]), {
    bookingFeePercentage: { from: 5, to: 7 },
    requireApproval: { from: false, to: true },
  });
});

test("objects and arrays compare by content, not identity", () => {
  const before = { permissions: { users: true, jobs: false }, tags: ["a", "b"] };
  const same = { permissions: { users: true, jobs: false }, tags: ["a", "b"] };
  assert.deepEqual(diffFields(before, same, ["permissions", "tags"]), {});
  const changed = { permissions: { users: true, jobs: true }, tags: ["a", "b"] };
  assert.deepEqual(Object.keys(diffFields(before, changed, ["permissions", "tags"])), ["permissions"]);
});

test("a field going from missing to set is a change; missing to null is not", () => {
  assert.deepEqual(diffFields({}, { subtitle: "New" }, ["subtitle"]), { subtitle: { from: null, to: "New" } });
  assert.deepEqual(diffFields({}, { subtitle: null }, ["subtitle"]), {});
});

test("descriptions name the field and both values, and summarise the rest", () => {
  const changes = {
    bookingFeePercentage: { from: 5, to: 7 },
    asapFee: { from: 50, to: 60 },
    providerStrikeLimit: { from: 3, to: 4 },
    noShowPayoutPercentage: { from: 50, to: 40 },
  };
  assert.equal(
    describeChanges(changes),
    "Booking fee percentage 5 → 7, ASAP fee 50 → 60, Provider strike limit 3 → 4 and 1 more"
  );
  assert.equal(describeChanges({ subtitle: { from: null, to: "Hi" } }), "Subtitle — → Hi");
  assert.equal(fieldLabel("clientCancellationDayOfFeePercentage"), "Client cancellation day of fee percentage");
});
