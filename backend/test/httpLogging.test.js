'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { requestSerializer, responseSerializer, requestLogObject, requestLogLevel } = require('../modules/httpLogging');

test('request logging keeps only safe compact fields', () => {
  const serialized = requestSerializer({ method: 'GET', originalUrl: '/api/nodes', id: 'req-1', headers: { authorization: 'Bearer secret' }, body: { password: 'secret' } });
  assert.deepEqual(serialized, { method: 'GET', url: '/api/nodes', requestId: 'req-1' });
});

test('expected auth failures are silent while server failures remain visible', () => {
  assert.equal(requestLogLevel({}, { statusCode: 401 }), 'silent');
  assert.equal(requestLogLevel({}, { statusCode: 404 }), 'info');
  assert.equal(requestLogLevel({}, { statusCode: 503 }), 'error');
});

test('response logging contains only the status code', () => {
  assert.deepEqual(responseSerializer({ statusCode: 401, locals: { token: 'secret' } }), { statusCode: 401 });
});

test('completed request log objects do not contain request or response objects', () => {
  assert.deepEqual(requestLogObject({ method: 'GET', originalUrl: '/api/health' }, { statusCode: 200 }, { responseTime: 4 }), {
    method: 'GET', url: '/api/health', statusCode: 200, responseTime: 4,
  });
});
