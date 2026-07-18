'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, withTransaction } = require('../platform/database');

function fakePool({ fail = false } = {}) {
  const calls = []; const client = { query: async (sql) => { calls.push(sql); if (fail && sql === 'WORK') throw new Error('work failed'); return { rows: [{ ok: 1 }] }; }, release: () => calls.push('RELEASE') };
  return { calls, connect: async () => client, query: client.query, end: async () => calls.push('END') };
}

test('transaction commits, rolls back failures, and always releases its client', async () => {
  const success = fakePool(); assert.deepEqual(await withTransaction(success, async (client) => client.query('WORK')), { rows: [{ ok: 1 }] }); assert.deepEqual(success.calls, ['BEGIN', 'WORK', 'COMMIT', 'RELEASE']);
  const failure = fakePool({ fail: true }); await assert.rejects(() => withTransaction(failure, async (client) => client.query('WORK')), /work failed/); assert.deepEqual(failure.calls, ['BEGIN', 'WORK', 'ROLLBACK', 'RELEASE']);
});

test('database wrapper exposes healthcheck and close over one injected pool', async () => {
  const pool = fakePool(); const database = createDatabase({ pool }); await database.healthcheck(); await database.close(); assert.deepEqual(pool.calls, ['SELECT 1', 'END']);
});
