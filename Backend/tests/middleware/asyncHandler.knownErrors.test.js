const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const asyncHandler = require("../../app/middleware/asyncHandler");
const { errorHandler } = require("../../app/middleware/errorHandler");
const ApiError = require("../../app/utils/ApiError");

/**
 * A wrapped handler's errors must reach the client with the status the error
 * handler assigns, not flattened into the endpoint's generic 500.
 *
 * asyncHandler used to turn every non-ApiError into ApiError.internal before
 * errorHandler saw it, so the CastError → 400 / duplicate key → 409 mappings
 * never ran for any wrapped route: GET /api/users/<not-an-id> answered
 * "500 Failed to fetch user details".
 */

/** Run `throwing` through asyncHandler and errorHandler; return { status, body }. */
async function respond(throwing) {
  const res = {
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const req = { method: "GET", originalUrl: "/api/test" };
  const forwarded = await new Promise((resolve) => {
    asyncHandler(async () => { throw throwing; }, "Failed to fetch thing")(req, res, resolve);
  });
  const { warn, error } = console;
  console.warn = console.error = () => {}; // the handler logs every failure
  try { errorHandler(forwarded, req, res, () => {}); } finally { console.warn = warn; console.error = error; }
  return { status: res.statusCode, body: res.body };
}

test("a malformed ObjectId is a 400, not the endpoint's 500", async () => {
  const { status, body } = await respond(new mongoose.Error.CastError("ObjectId", "counts", "_id"));
  assert.equal(status, 400);
  assert.equal(body.message, "Invalid _id");
});

test("a failed validation is a 400 naming the field's problem", async () => {
  const validation = new mongoose.Error.ValidationError();
  validation.addError("phone", new mongoose.Error.ValidatorError({ message: "Path `phone` is required.", path: "phone" }));
  const { status, body } = await respond(validation);
  assert.equal(status, 400);
  assert.equal(body.message, "Path `phone` is required.");
});

test("a duplicate key is a 409", async () => {
  const duplicate = Object.assign(new Error("E11000 duplicate key"), { code: 11000, keyPattern: { email: 1 } });
  const { status, body } = await respond(duplicate);
  assert.equal(status, 409);
  assert.equal(body.message, "That email is already taken");
});

test("an ApiError keeps its own status and message", async () => {
  const { status, body } = await respond(ApiError.notFound("User not found"));
  assert.equal(status, 404);
  assert.equal(body.message, "User not found");
});

test("anything else is a 500 in the endpoint's own wording", async () => {
  const { status, body } = await respond(new Error("socket hang up"));
  assert.equal(status, 500);
  assert.equal(body.message, "Failed to fetch thing");
});
