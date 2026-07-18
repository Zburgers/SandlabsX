'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { OperationService, MemoryOperationStore } = require('../services/operationService');
const { Runner } = require('../runner/runner');

test('Runner leases one operation and retries a retryable stable step without duplicate completion', async () => {
  const store = new MemoryOperationStore(); const operations = new OperationService({ store, maxAttempts: 2 });
  const operation = await operations.submit({ ownerId: 'user-a', type: 'START', instanceId: 'instance-a', idempotencyKey: 'run-once' });
  let calls = 0; const runner = new Runner({ id: 'runner-a', operations, handlers: { START: () => [{ key: 'start', run: async () => { calls += 1; if (calls === 1) throw Object.assign(new Error('temporary'), { retryable: true }); } }] } });
  await runner.runOnce();
  assert.equal(calls, 2); assert.equal((await store.get(operation.id)).state, 'SUCCEEDED');
  assert.equal(await runner.runOnce(), null);
});
