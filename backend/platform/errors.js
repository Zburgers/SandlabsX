'use strict';
class PlatformError extends Error { constructor(code, message, options = {}) { super(message, { cause: options.cause }); this.name = 'PlatformError'; this.code = code; this.retryable = Boolean(options.retryable); this.status = options.status || 400; } }
function toPublicError(error) {
  if (error instanceof PlatformError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return { code: 'INTERNAL_ERROR', message: 'An internal error occurred', retryable: false };
}
module.exports = { PlatformError, toPublicError };
