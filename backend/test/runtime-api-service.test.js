'use strict';
const assert = require('node:assert/strict'); const test = require('node:test');
const { RuntimeApiService } = require('../services/runtimeApiService');
test('runtime API derives link and checkpoint operation inputs from the persisted owned plan', async () => {
  const submitted = []; const instance = { id: 'instance-a', ownerId: 'user-a', name: 'lab', state: 'STOPPED', createdAt: 'now' };
  const plan = { interfaces: [{ nodeId: 'r1', interfaceId: 'eth0', tap: 'tap-owned' }], disks: [{ nodeId: 'r1', overlayPath: '/overlays/owned.qcow2' }] };
  const service = new RuntimeApiService({ pool: { query: async () => ({ rows: [] }) }, instances: { get: async id => id === instance.id ? instance : null, getExecutionPlan: async () => ({ document: plan }) }, operationService: { submit: async (_actor, input) => (submitted.push(input), { id: `op-${submitted.length}` }) }, secret: 'test-runtime-secret' });
  await service.createCheckpoint({ id: 'user-a' }, instance.id, { name: 'baseline' }, 'checkpoint-key');
  await service.setLinkState({ id: 'user-a' }, instance.id, 'eth0', false, 'link-key');
  assert.equal(submitted[0].input.nodes[0].overlayPath, '/overlays/owned.qcow2');
  assert.deepEqual(submitted[1].input.interface, { name: 'tap-owned', ownership: { instanceId: 'instance-a', nodeId: 'r1' } });
  await assert.rejects(service.setLinkState({ id: 'other' }, instance.id, 'eth0', true, 'foreign'), error => error.code === 'NOT_FOUND');
});
