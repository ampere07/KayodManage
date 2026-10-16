/**
 * ApiError — an error that already knows what the client should be told.
 *
 * Controllers used to decide the HTTP status inline and then hand-render the
 * body at every exit, which is how this API ended up answering failures two
 * different ways (`{ error }` in some places, `{ success, error }` in others)
 * with no single place to change either. Throwing one of these instead leaves
 * the rendering to errorHandler, so the shape is decided once.
 *
 * `expected` marks the difference between "the caller asked for something we
 * won't do" (a 404, a validation failure) and "we broke". Expected errors are
 * logged as a single line; unexpected ones keep their stack, because those are
 * the ones anyone will actually need to debug.
 */
class ApiError extends Error {
  constructor(statusCode, message, { expected = true, details = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.expected = expected;
    this.details = details;
    if (cause) this.cause = cause;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(400, message, { details });
  }

  static unauthorized(message = 'Not authenticated') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Not authorized') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict', details = null) {
    return new ApiError(409, message, { details });
  }

  /** Something genuinely went wrong on our side — keep the stack. */
  static internal(message = 'Internal server error', cause = null) {
    return new ApiError(500, message, { expected: false, cause });
  }
}

module.exports = ApiError;
