const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

/**
 * Which escrow states a dispute ruling may move money from.
 *
 * ── Why this is a guard and not a comment ────────────────────────────────────
 *
 * All three dispute outcomes used to require the escrow Transaction to still be
 * `held`. That is only its FIRST resting state. Once both parties confirm
 * completion, kayod/server flips it to `completed`, empties the client's
 * heldBalance and schedules an EscrowRelease for the warranty window — and a
 * dispute raised in THAT window (the ordinary case, offered by the client's own
 * "File a Dispute" action) could not be resolved by any outcome. Every ruling
 * returned "No held payment found", the payout stayed frozen by the dispute, and
 * the booking deadlocked with the money in limbo.
 *
 * The interesting cases are the boundaries, so they are pinned per state rather
 * than described: settleable while the release is still pending, refused the
 * moment it has actually paid out or been returned.
 */

const HELPER = path.resolve(__dirname, "../../app/utils/settleableEscrow.js");
const TRANSACTION = path.resolve(__dirname, "../../app/models/Transaction.js");
const ESCROW_SERVICE = path.resolve(__dirname, "../../app/services/escrowService.js");

/** Loads the helper with its two collaborators stubbed, so no database is needed. */
function loadHelper({ transaction, liveRelease }) {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    const resolved = (() => {
      try {
        return Module._resolveFilename(request, parent);
      } catch {
        return request;
      }
    })();

    if (resolved === TRANSACTION) {
      return {
        findById: () => ({ session: async () => transaction }),
      };
    }
    if (resolved === ESCROW_SERVICE) {
      return { findLiveEscrowRelease: async () => liveRelease };
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    delete require.cache[HELPER];
    return require(HELPER);
  } finally {
    Module._load = originalLoad;
    delete require.cache[HELPER];
  }
}

const JOB_ID = "6a89a2116625d44698b9a50f";

function job(overrides = {}) {
  return {
    _id: JOB_ID,
    escrowStatus: "pending",
    paymentDetails: { heldTransaction: "t1" },
    completionStatus: {},
    ...overrides,
  };
}

test("a still-held payment is settleable, and reports the held stage", async () => {
  const { findSettleableEscrow } = loadHelper({
    transaction: { _id: "t1", status: "held", amount: 1500 },
    liveRelease: null,
  });

  const result = await findSettleableEscrow(job());
  assert.equal(result.stage, "held");
  assert.equal(result.amount, 1500);
});

test("after completion, a payment awaiting its warranty release is settleable", async () => {
  const { findSettleableEscrow } = loadHelper({
    transaction: { _id: "t1", status: "completed", amount: 1500 },
    liveRelease: { _id: "r1", status: "scheduled" },
  });

  // The exact case every outcome used to reject.
  const result = await findSettleableEscrow(job());
  assert.equal(result.stage, "scheduled");
  assert.equal(result.amount, 1500);
});

test("a payment that already reached the provider is NOT settleable", async () => {
  const { findSettleableEscrow } = loadHelper({
    transaction: { _id: "t1", status: "completed", amount: 1500 },
    liveRelease: { _id: "r1", status: "scheduled" },
  });

  assert.equal(
    await findSettleableEscrow(
      job({ completionStatus: { paymentReleased: true } })
    ),
    null
  );
});

test("a released or refunded escrow is NOT settleable", async () => {
  for (const escrowStatus of ["released", "refunded"]) {
    const { findSettleableEscrow } = loadHelper({
      transaction: { _id: "t1", status: "completed", amount: 1500 },
      liveRelease: { _id: "r1", status: "scheduled" },
    });
    assert.equal(await findSettleableEscrow(job({ escrowStatus })), null, escrowStatus);
  }
});

test("no live release means there is nothing left to move", async () => {
  const { findSettleableEscrow } = loadHelper({
    transaction: { _id: "t1", status: "completed", amount: 1500 },
    liveRelease: null,
  });

  assert.equal(await findSettleableEscrow(job()), null);
});

test("a job with no held transaction reference is not settleable", async () => {
  const { findSettleableEscrow } = loadHelper({
    transaction: null,
    liveRelease: { _id: "r1", status: "scheduled" },
  });

  assert.equal(await findSettleableEscrow(job({ paymentDetails: {} })), null);
});
