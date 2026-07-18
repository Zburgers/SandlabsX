'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { ConsoleService, OwnershipError } = require('../runtime/consoleService');

test('ConsoleService scopes short-lived tokens and reverses owned registration', async () => {
  const registrations = new Map();
  const service = new ConsoleService({ registry: { register: async input => { registrations.set(input.id, input); return { id: input.id }; }, unregister: async id => registrations.delete(id) }, now: () => 1000 });
  const endpoint = await service.register({ instanceId: 'instance-a', nodeId: 'node-a', type: 'vnc', endpoint: '127.0.0.1:5901' });
  const token = service.issueToken(endpoint, { userId: 'user-a', ttlMs: 500 });
  assert.deepEqual(service.verifyToken(token, { userId: 'user-a', instanceId: 'instance-a', nodeId: 'node-a' }), { userId: 'user-a', instanceId: 'instance-a', nodeId: 'node-a' });
  await assert.rejects(service.unregister(endpoint, { instanceId: 'other', nodeId: 'node-a' }), OwnershipError);
  await service.unregister(endpoint, endpoint.ownership); assert.equal(registrations.size, 0);
});
