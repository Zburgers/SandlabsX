'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { QemuProcessService, OwnershipError } = require('../runtime/qemuProcessService');

test('QemuProcessService uses argument arrays, verifies identity, and never kills a reused PID', async () => {
  const children = new Map();
  const runner = { spawn: async (command, args) => { children.set(42, { command, args }); return { pid: 42 }; }, inspectProcess: async pid => pid === 42 ? children.get(42) : null, signal: async pid => children.delete(pid) };
  const service = new QemuProcessService({ runner, readiness: async () => true });
  const process = await service.start({ instanceId: 'instance-a', nodeId: 'node-a', command: 'qemu-system-x86_64', args: ['-name', 'sandlabx-instance-a-node-a'] });
  assert.equal(process.pid, 42); assert.equal(await service.ready(process), true);
  children.set(42, { command: 'unrelated', args: [] });
  await assert.rejects(service.stop(process), OwnershipError);
});
