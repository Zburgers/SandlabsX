'use strict';
class PlatformError extends Error { constructor(code, message, options = {}) { super(message, { cause: options.cause }); this.name = 'PlatformError'; this.code = code; this.retryable = Boolean(options.retryable); this.status = options.status || 400; } }
function toPublicError(error) { return { code: error?.code || 'INTERNAL_ERROR', message: error?.code ? error.message : 'An internal error occurred', retryable: Boolean(error?.retryable) }; }
module.exports = { PlatformError, toPublicError };
