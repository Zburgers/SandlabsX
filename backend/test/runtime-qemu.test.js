'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { QemuProcessService, OwnershipError } = require('../runtime/qemuProcessService');
const { ProcessRunner } = require('../runtime/processRunner');

test('QemuProcessService uses argument arrays, verifies identity, and never kills a reused PID', async () => {
  const children = new Map();
  const runner = { spawn: async (command, args) => { children.set(42, { command, args }); return { pid: 42 }; }, inspectProcess: async pid => pid === 42 ? children.get(42) : null, signal: async pid => children.delete(pid) };
  const service = new QemuProcessService({ runner, readiness: async () => true });
  const process = await service.start({ instanceId: 'instance-a', nodeId: 'node-a', command: 'qemu-system-x86_64', args: ['-name', 'sandlabx-instance-a-node-a'] });
  assert.equal(process.pid, 42); assert.equal(await service.ready(process), true);
  children.set(42, { command: 'unrelated', args: [] });
  await assert.rejects(service.stop(process), OwnershipError);
});

test('ProcessRunner cannot be coerced into shell or detached execution', async () => {
  const calls = [];
  const { EventEmitter } = require('node:events');
  const spawnImpl = (_command, _args, options) => {
    calls.push(options); const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = 42;
    process.nextTick(() => child.emit(calls.length === 1 ? 'close' : 'spawn', 0, null)); return child;
  };
  const runner = new ProcessRunner({ spawnImpl });
  await runner.run('qemu-img', ['info'], { shell: true, stdio: 'inherit' });
  await runner.spawn('qemu-system-x86_64', ['-name', 'safe'], { shell: true, detached: true, stdio: 'inherit' });
  assert.equal(calls[0].shell, false); assert.deepEqual(calls[0].stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(calls[1].shell, false); assert.equal(calls[1].detached, false); assert.equal(calls[1].stdio, 'ignore');
});

test('ProcessRunner inspects proc identity, observes links, signals only numeric PIDs, and bounds output', async () => {
  const signals = []; const outputs = [];
  const runner = new ProcessRunner({
    maxOutputBytes: 64,
    readFile: async file => { assert.equal(file, '/proc/42/cmdline'); return Buffer.from('/usr/bin/qemu-system-x86_64\0-name\0owned\0'); },
    killImpl: (pid, signal) => signals.push([pid, signal]),
    spawnImpl: (_command, args) => { const { EventEmitter } = require('node:events'); const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); process.nextTick(() => { if (args[0] === '-json') child.stdout.emit('data', JSON.stringify([{ ifname: 'tap-a', operstate: 'UP' }])); else child.stdout.emit('data', 'x'.repeat(70)); child.emit('close', 0, null); }); return child; },
  });
  assert.deepEqual(await runner.inspectProcess(42), { command: '/usr/bin/qemu-system-x86_64', args: ['-name', 'owned'] });
  assert.deepEqual(await runner.inspectLink('tap-a'), { name: 'tap-a', up: true, state: 'UP' });
  outputs.push(await runner.run('tool', [])); assert.equal(outputs[0].stdout, 'x'.repeat(64));
  await runner.signal(42, 'SIGTERM'); assert.deepEqual(signals, [[42, 'SIGTERM']]);
  await assert.rejects(runner.signal('42; reboot', 'SIGTERM'), /numeric PID/);
});
