'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createReadinessService } = require('../platform/readiness');

test('readiness is degraded for optional dependencies and unhealthy for required ones', async () => {
  const readiness = createReadinessService({
    database: { healthcheck: async () => {} },
    runner: { isFresh: async () => false },
    storage: { check: async () => ({ writable: true, freeBytes: 1024 }) },
    guacamole: { check: async () => false },
    host: { check: async () => ({ kvm: true, tun: true }) },
  });

  const result = await readiness.check();
  assert.equal(result.status, 'degraded');
  assert.equal(result.checks.database.status, 'healthy');
  assert.equal(result.checks.guacamole.status, 'degraded');
});

test('readiness is unhealthy when the database is unavailable', async () => {
  const readiness = createReadinessService({ database: { healthcheck: async () => { throw new Error('offline'); } } });
  const result = await readiness.check();
  assert.equal(result.status, 'unhealthy');
  assert.equal(result.checks.database.status, 'unhealthy');
});
