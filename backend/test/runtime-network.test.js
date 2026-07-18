'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { NetworkService, OwnershipError } = require('../runtime/networkService');

test('NetworkService creates, observes, and deletes only owned segments and TAPs', async () => {
  const calls = []; const state = new Map();
  const runner = { run: async (command, args) => { calls.push([command, args]); if (args[0] === 'add' || args[1] === 'add') state.set(args[2] === 'dev' ? args[3] : args[2], true); if (args[0] === 'del' || args[1] === 'del') state.delete(args.at(-1)); return { code: 0 }; }, inspectLink: async name => state.has(name) ? { name, up: true } : null };
  const service = new NetworkService({ runner });
  const segment = await service.createSegment({ instanceId: 'instance-a', id: 'segment-a', bridge: 'br-a' });
  const tap = await service.createTap({ instanceId: 'instance-a', nodeId: 'node-a', name: 'tap-a', segment });
  assert.deepEqual(await service.observeTap(tap), { name: 'tap-a', up: true });
  await assert.rejects(service.deleteTap(tap, { instanceId: 'other', nodeId: 'node-a' }), OwnershipError);
  await service.setLinkState(tap, false, tap.ownership); await service.deleteTap(tap, tap.ownership); await service.deleteSegment(segment, segment.ownership);
  assert.ok(calls.every(([, args]) => args[0] !== 'exec'));
});
