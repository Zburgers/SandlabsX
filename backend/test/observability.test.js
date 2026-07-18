'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createObservability, sanitize } = require('../platform/observability');
const { PlatformError, toPublicError } = require('../platform/errors');
const { requestContext } = require('../middleware/requestContext');
const { AuditRepository } = require('../platform/auditRepository');

test('redacts secrets recursively while preserving correlation and bounding fields', () => {
  const event = sanitize({ requestId: 'req-1', authorization: 'Bearer secret', nested: { password: 'x' }, output: 'x'.repeat(5000) });
  assert.equal(event.requestId, 'req-1');
  assert.equal(event.authorization, '[REDACTED]');
  assert.equal(event.nested.password, '[REDACTED]');
  assert.match(event.output, /\[TRUNCATED\]$/);
});

test('public errors do not expose internal messages', () => {
  assert.deepEqual(toPublicError(new Error('database password leaked')), { code: 'INTERNAL_ERROR', message: 'An internal error occurred', retryable: false });
  assert.deepEqual(toPublicError(Object.assign(new Error('duplicate key on secret@example.test'), { code: '23505' })), { code: 'INTERNAL_ERROR', message: 'An internal error occurred', retryable: false });
  assert.deepEqual(toPublicError(new PlatformError('CAPSULE_INVALID', 'Capsule is invalid')), { code: 'CAPSULE_INVALID', message: 'Capsule is invalid', retryable: false });
});

test('request context accepts valid IDs and creates correlated child logging', () => {
  const children = [];
  const middleware = requestContext({ observability: { child: (fields) => { children.push(fields); return { info() {} }; } } });
  const req = { get: () => 'req-42' };
  const res = { set: (key, value) => { res[key] = value; } };
  let called = false;
  middleware(req, res, () => { called = true; });
  assert.equal(called, true); assert.equal(req.requestId, 'req-42'); assert.equal(res['X-Request-Id'], 'req-42'); assert.deepEqual(children, [{ requestId: 'req-42' }]);
});

test('observability emits bounded structured events and audit repository uses parameterized inserts', async () => {
  const calls = [];
  const logger = { child: () => logger, info: (event) => calls.push(event) };
  createObservability({ logger }).event({ token: 'secret', requestId: 'req-1' }, 'operation.started');
  assert.equal(calls[0].token, '[REDACTED]');
  const pool = { query: async (sql, values) => ({ sql, values }) };
  const result = await new AuditRepository({ pool }).append({ action: 'capsule.publish', resource_type: 'capsule', metadata: { password: 'not logged by repository' } });
  assert.match(result.sql, /INSERT INTO sandlabx_audit_events/); assert.match(result.sql, /\$1/); assert.equal(result.values[1], 'capsule.publish');
  assert.equal(result.values[5].password, '[REDACTED]');
});
