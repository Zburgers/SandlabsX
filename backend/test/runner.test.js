'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { OperationService, MemoryOperationStore } = require('../services/operationService');
const { Runner } = require('../runner/runner');
const { createOperationHandlers } = require('../runner/operationHandlers');
const { createRunnerRuntime } = require('../runner/production');

test('Runner leases one operation and retries a retryable stable step without duplicate completion', async () => {
  const store = new MemoryOperationStore(); const operations = new OperationService({ store, maxAttempts: 2 });
  const operation = await operations.submit({ ownerId: 'user-a', type: 'START', instanceId: 'instance-a', idempotencyKey: 'run-once' });
  let calls = 0; const runner = new Runner({ id: 'runner-a', operations, handlers: { START: () => [{ key: 'start', run: async () => { calls += 1; if (calls === 1) throw Object.assign(new Error('temporary'), { retryable: true }); } }] } });
  await runner.runOnce();
  assert.equal(calls, 2); assert.equal((await store.get(operation.id)).state, 'SUCCEEDED');
  assert.equal(await runner.runOnce(), null);
});

test('Runner terminally fails a leased operation when handler construction rejects its input', async () => {
  const store = new MemoryOperationStore(); const operations = new OperationService({ store });
  const operation = await operations.submit({ ownerId: 'user-a', type: 'DESTROY', instanceId: 'instance-a', idempotencyKey: 'destroy-empty' });
  const runner = new Runner({ id: 'runner-a', operations, handlers: { DESTROY: () => { throw Object.assign(new Error('owned resources required'), { code: 'OWNED_RESOURCES_REQUIRED' }); } } });
  await assert.rejects(runner.runOnce(), error => error.code === 'OWNED_RESOURCES_REQUIRED');
  const finished = await store.get(operation.id);
  assert.equal(finished.state, 'FAILED');
  assert.equal(finished.error.code, 'OWNED_RESOURCES_REQUIRED');
  assert.equal(await runner.runOnce(), null);
});

test('lifecycle handlers execute runtime ports and expose reverse compensation', async () => {
  const calls = [];
  const handlers = createOperationHandlers({
    disk: { createOverlay: async input => (calls.push(['disk.create', input.nodeId]), { path: input.overlayPath, ownership: input }), removeOverlay: async resource => calls.push(['disk.remove', resource.ownership.nodeId]) },
    network: { createSegment: async input => (calls.push(['segment.create', input.id]), { ...input, ownership: { instanceId: input.instanceId, nodeId: '_segment' } }), deleteSegment: async resource => calls.push(['segment.delete', resource.id]), createTap: async input => (calls.push(['tap.create', input.nodeId]), { name: input.name, ownership: input }), deleteTap: async resource => calls.push(['tap.delete', resource.ownership.nodeId]) },
    qemu: { start: async input => (calls.push(['qemu.start', input.nodeId]), { pid: 7, ownership: input, identity: { command: input.command, args: input.args } }), ready: async resource => (calls.push(['qemu.ready', resource.ownership.nodeId]), true), stop: async resource => calls.push(['qemu.stop', resource.ownership.nodeId]) },
    console: { register: async input => (calls.push(['console.register', input.nodeId]), { id: input.nodeId, ownership: input }), unregister: async resource => calls.push(['console.unregister', resource.ownership.nodeId]) },
    checkpoints: { create: async () => calls.push(['checkpoint.create']), restore: async () => calls.push(['checkpoint.restore']) },
    capture: { capture: async () => calls.push(['capture']) },
  });
  const operation = { instanceId: 'instance-a', ownerId: 'user-a', input: { plan: { disks: [{ nodeId: 'node-a', overlayPath: '/tmp/a', baseImage: '/tmp/base' }], segments: [{ id: 'lan', hostBridge: 'br-a' }], interfaces: [{ nodeId: 'node-a', tap: 'tap-a', segmentId: 'lan' }], consoles: [{ nodeId: 'node-a', type: 'serial', endpoint: '127.0.0.1:7000' }], processes: [{ nodeId: 'node-a', command: 'qemu-system-x86_64', args: ['-name', 'safe'] }] } } };
  const provision = handlers.PROVISION(operation); for (const step of provision) await step.run();
  assert.deepEqual(calls.slice(0, 4).map(call => call[0]), ['disk.create', 'segment.create', 'tap.create', 'console.register']);
  const start = handlers.START(operation); await start[0].run(); await start[0].compensate();
  assert.deepEqual(calls.slice(-3).map(call => call[0]), ['qemu.start', 'qemu.ready', 'qemu.stop']);
});

test('production runner composition uses one injected pool and host capability adapter', () => {
  const pool = { query: async () => ({ rows: [] }), connect: async () => { throw new Error('not used'); } };
  const processRunner = { run: async () => ({ code: 0, stdout: '[]', stderr: '' }), spawn: async () => ({ pid: 42 }), inspectProcess: async () => ({ command: 'qemu-system-x86_64', args: [] }), inspectLink: async () => null, signal: async () => {} };
  const runtime = createRunnerRuntime({ pool, processRunner, env: { RUNNER_ID: 'runner-test', OVERLAYS_PATH: '/tmp/overlays', CHECKPOINTS_PATH: '/tmp/checkpoints', CUSTOM_IMAGES_PATH: '/tmp/images', IMAGE_CATALOG_PATH: '/tmp/catalog.json', CONSOLE_TOKEN_SECRET: 'test-secret' } });
  assert.equal(runtime.id, 'runner-test');
  assert.equal(runtime.runner.operations, runtime.operations);
  assert.ok(runtime.handlers.START && runtime.handlers.PROVISION && runtime.handlers.DESTROY);
});
