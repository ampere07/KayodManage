const ApiError = require('../utils/ApiError');
const { classifyKnownError } = require('./errorHandler');

/**
 * asyncHandler — wrap an async route handler so a rejected promise reaches the
 * central error handler instead of hanging the request.
 *
 * Express 4 does not await handlers: an async function that throws rejects a
 * promise nobody is watching, so without a try/catch the client just waits
 * until it times out. That is why every controller here grew its own
 * try/catch — 90 of them, each ending in the same console.error plus a
 * hand-written 500.
 *
 * `fallbackMessage` is what the client is told when an unexpected error escapes
 * this handler. It exists so that centralising the error path does not flatten
 * every failure into one generic string: the specific wording each endpoint
 * already returned ("Failed to fetch transactions") is preserved, just declared
 * once at the top instead of repeated in a catch block at the bottom.
 *
 *   router.get('/', adminAuth, asyncHandler(getTransactions, 'Failed to fetch transactions'));
 *
 * Errors thrown as ApiError pass through untouched — they already carry the
 * status and message the client should see.
 */
const asyncHandler = (handler, fallbackMessage = 'Internal server error') =>
  function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      if (error instanceof ApiError) return next(error);

      // A malformed id, a failed validation, a duplicate key: the request was
      // wrong, and the client should hear that (400/409), not this endpoint's 500.
      const known = classifyKnownError(error);
      if (known) return next(known);

      // Anything else is a surprise: keep the original as the cause so the
      // stack survives into the log, but answer with this endpoint's wording.
      return next(ApiError.internal(fallbackMessage, error));
    });
  };

module.exports = asyncHandler;
module.exports.asyncHandler = asyncHandler;
