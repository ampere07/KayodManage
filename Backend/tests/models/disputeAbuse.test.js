const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const {
  resolutionWentAgainstRaiser,
  raiserUserId,
} = require("../../app/utils/disputeAbuse");

/**
 * Which rulings count against the party who raised the dispute.
 *
 * This mapping is the whole judgement in the feature — everything else is a
 * rolling count — so it is worth pinning every combination rather than the two
 * that happen to be common.
 */

test("a client's claim not holding counts against the client", () => {
  assert.equal(resolutionWentAgainstRaiser("client", "provider_paid"), true);
  // The client was found responsible for the no-show they complained about.
  assert.equal(resolutionWentAgainstRaiser("client", "no_show_payout"), true);
});

test("a client winning counts against nobody", () => {
  assert.equal(resolutionWentAgainstRaiser("client", "client_refunded"), false);
});

test("a provider's claim not holding counts against the provider", () => {
  assert.equal(
    resolutionWentAgainstRaiser("provider", "client_refunded"),
    true
  );
});

test("a provider winning counts against nobody", () => {
  assert.equal(resolutionWentAgainstRaiser("provider", "provider_paid"), false);
  assert.equal(
    resolutionWentAgainstRaiser("provider", "no_show_payout"),
    false
  );
});

test("rebook counts against nobody, whoever raised it", () => {
  // Ordering the work redone is not a finding about who was telling the truth,
  // so it must not feed a restriction in either direction.
  assert.equal(resolutionWentAgainstRaiser("client", "rebook"), false);
  assert.equal(resolutionWentAgainstRaiser("provider", "rebook"), false);
});

test("an unknown or missing raiser counts against nobody", () => {
  // A dispute with no recorded raiser must never restrict a random party.
  assert.equal(resolutionWentAgainstRaiser(null, "provider_paid"), false);
  assert.equal(resolutionWentAgainstRaiser(undefined, "client_refunded"), false);
  assert.equal(resolutionWentAgainstRaiser("admin", "provider_paid"), false);
});

test("the raiser resolves to the right side of the job", () => {
  const clientId = new mongoose.Types.ObjectId();
  const providerId = new mongoose.Types.ObjectId();
  const job = { userId: clientId, assignedToId: providerId };

  assert.equal(raiserUserId(job, "client"), clientId);
  assert.equal(raiserUserId(job, "provider"), providerId);
  assert.equal(raiserUserId(job, null), null);
});

test("a job with no assigned provider yields no provider raiser", () => {
  // Guards against restricting `null` — which would throw, or worse, match a
  // document by accident.
  const job = { userId: new mongoose.Types.ObjectId(), assignedToId: null };
  assert.equal(raiserUserId(job, "provider"), null);
});
