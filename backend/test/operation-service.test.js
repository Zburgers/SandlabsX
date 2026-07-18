'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { OperationService, MemoryOperationStore } = require('../services/operationService');

test('OperationService makes idempotent operations, preserves stable step keys, and compensates cancellation', async () => {
  const store = new MemoryOperationStore(); const service = new OperationService({ store });
  const first = await service.submit({ ownerId: 'user-a', type: 'START', instanceId: 'instance-a', idempotencyKey: 'same-request' });
  const duplicate = await service.submit({ ownerId: 'user-a', type: 'START', instanceId: 'instance-a', idempotencyKey: 'same-request' });
  assert.equal(first.id, duplicate.id);
  await service.requestCancel(first.id, 'user-a');
  const order = [];
  const result = await service.execute(first.id, [{ key: 'disk', run: async () => order.push('disk'), compensate: async () => order.push('undo-disk') }, { key: 'qemu', run: async () => order.push('qemu') }]);
  assert.equal(result.state, 'CANCELLED'); assert.deepEqual(order, ['disk', 'undo-disk']);
  assert.equal((await store.steps(first.id)).filter(step => step.key === 'disk').length, 1);
});
