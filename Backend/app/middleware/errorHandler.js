const ApiError = require('../utils/ApiError');

/**
 * The single place this API decides what a failure looks like.
 *
 * ── Why the body carries both `error` and `message` ──────────────────────────
 *
 * The admin frontend reads failures two different ways, because the backend
 * answered them two different ways: `response.data.message` in most of the
 * hooks, `response.data.error` in the rest. Picking one and migrating the
 * other would mean changing both repos in lockstep to avoid a window where
 * errors render as "undefined".
 *
 * So the envelope carries both keys with the same string, plus the `success`
 * flag the newer endpoints already set. Every existing consumer keeps working
 * unchanged, and new code has one shape to write against. This is deliberate
 * duplication with a purpose, not an oversight.
 */

/**
 * The Mongo/Mongoose errors that mean the request was wrong, mapped to the
 * answer the client should get; null for anything else.
 *
 * Exported for asyncHandler: it wraps every unexpected error in its endpoint's
 * generic 500, so unless it checks here first these mappings never run for a
 * wrapped handler — a malformed id would still come back as a 500.
 */
function classifyKnownError(error) {
  // Bad payload — the caller's problem, not ours.
  if (error?.name === 'ValidationError') {
    const fields = Object.values(error.errors || {}).map((field) => field.message);
    return new ApiError(400, fields[0] || 'Validation failed', { details: fields });
  }

  // A malformed ObjectId in the URL. Common enough from the admin UI that a
  // 500 here is actively misleading.
  if (error?.name === 'CastError') {
    return new ApiError(400, `Invalid ${error.path || 'identifier'}`);
  }

  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    return new ApiError(409, field ? `That ${field} is already taken` : 'Duplicate value');
  }

  return null;
}

/** Translate the errors Mongo and Mongoose throw into a client-facing answer. */
function normalize(error) {
  if (error instanceof ApiError) return error;
  return classifyKnownError(error) || ApiError.internal(error?.message || 'Internal server error', error);
}

function errorHandler(error, req, res, next) {
  // Something already started writing — Express's own handler has to finish it,
  // or the client gets a second set of headers on top of a partial body.
  if (res.headersSent) return next(error);

  const apiError = normalize(error);
  const { statusCode, message } = apiError;

  // Expected failures are noise at stack-trace volume; unexpected ones are the
  // only reason anyone reads these logs, so those keep the original cause.
  if (apiError.expected) {
    console.warn(`[${req.method} ${req.originalUrl}] ${statusCode} ${message}`);
  } else {
    console.error(`[${req.method} ${req.originalUrl}] ${statusCode} ${message}`);
    console.error(apiError.cause || apiError);
  }

  return res.status(statusCode).json({
    success: false,
    // Both keys, same value — see the note above.
    error: message,
    message,
    ...(apiError.details ? { details: apiError.details } : {}),
    ...(process.env.NODE_ENV === 'development' && apiError.cause
      ? { stack: apiError.cause.stack }
      : {}),
  });
}

/** An unmatched /api route is a 404, not the SPA's index.html. */
function notFoundHandler(req, res, next) {
  return next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

module.exports = { errorHandler, notFoundHandler, classifyKnownError };
