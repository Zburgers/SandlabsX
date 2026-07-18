'use strict';
const pino = require('pino');
const SECRET = /authorization|password|passwd|token|secret|cookie|private.?key|credential/i;
function sanitize(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 4096 ? `${value.slice(0, 4096)}...[TRUNCATED]` : value;
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key, SECRET.test(key) ? '[REDACTED]' : sanitize(item, depth + 1)]));
}
function createObservability(config = {}) {
  const logger = config.logger || pino({ level: config.level || process.env.LOG_LEVEL || 'info', base: { service: config.service || 'sandboxlabs-backend' } });
  return { logger, sanitize, child: (fields) => logger.child(sanitize(fields)), event: (fields, message) => logger.info(sanitize({ ...fields, message })) };
}
module.exports = { createObservability, sanitize };
