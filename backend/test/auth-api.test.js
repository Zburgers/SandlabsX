'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { createApp, httpLogObject } = require('../app');

function services(authService) {
  const unavailable = new Proxy({}, { get: () => async () => { throw new Error('not used'); } });
  return { authService, capsuleService: unavailable, scenarioService: unavailable, assignmentService: unavailable, instanceService: unavailable, operationService: unavailable, eventService: unavailable, imageArtifacts: unavailable, workloadProfiles: unavailable };
}

async function withServer(app, fn) {
  const server = http.createServer(app).listen(0);
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('login route returns a JSON authentication response instead of an HTML fallback', async () => {
  const authService = { login: async () => { throw Object.assign(new Error('Invalid credentials'), { status: 401, code: 'INVALID_CREDENTIALS' }); } };
  const app = createApp({ services: services(authService), authenticate: (_req, _res, next) => next(), readiness: { check: async () => ({ status: 'healthy', checks: {} }) } });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'student@example.test', password: 'secret-value' }) });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { success: false, code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' });
  });
});

test('authenticated profile route returns the user needed after login', async () => {
  const authService = {
    login: async () => ({ token: 'token', user: { id: 'user-1', email: 'student@example.test', role: 'student' } }),
    currentUser: async ({ userId }) => ({ user: { id: userId, email: 'student@example.test', role: 'student' } }),
  };
  const app = createApp({
    services: services(authService),
    authenticate: (req, _res, next) => { req.auth = { sub: 'user-1' }; next(); },
    readiness: { check: async () => ({ status: 'healthy', checks: {} }) },
  });

  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/auth/me`, { headers: { authorization: 'Bearer token' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      user: { id: 'user-1', email: 'student@example.test', role: 'student' },
    });
  });
});

test('API misses return JSON and request logging excludes request bodies and secrets', async () => {
  const app = createApp({ services: services({ login: async () => ({}) }), authenticate: (_req, _res, next) => next(), readiness: { check: async () => ({ status: 'healthy', checks: {} }) } });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/missing`, { headers: { authorization: 'Bearer do-not-log' } });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(typeof response.headers.get('x-request-id'), 'string');
  });
  const logged = httpLogObject(
    { method: 'POST', originalUrl: '/api/auth/login', socket: { remoteAddress: '127.0.0.1' }, headers: { authorization: 'do-not-log' }, body: { password: 'do-not-log' } },
    { statusCode: 401 },
    { responseTime: 12 },
  );
  assert.deepEqual(logged, { request: { method: 'POST', path: '/api/auth/login', remoteAddress: '127.0.0.1' }, response: { statusCode: 401 }, responseTime: 12 });
  assert.doesNotMatch(JSON.stringify(logged), /do-not-log|password|authorization/i);
});
