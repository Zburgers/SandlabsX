'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { GuestCommandCheck } = require('../verification/guestCommandCheck');

const author = { id: 'instructor-1', role: 'instructor' };
const instance = { id: 'instance-1', ownerId: 'student-1', nodes: [{ id: 'node-r1', name: 'r1' }] };
const check = { id: 'ospf-neighbor', type: 'guestCommand', targetVm: 'node-r1', argv: ['vtysh', '-c', 'show ip ospf neighbor'], expected: { contains: 'Full' }, limits: { timeoutMs: 100, maxOutputBytes: 64, cpuMs: 50 } };

test('runs an instructor-authored argv-only guest command through a qualified owned-VM transport and audits redacted evidence', async () => {
  const events = [];
  const calls = [];
  const verifier = new GuestCommandCheck({
    transport: { qualified: true, execute: async input => { calls.push(input); return { output: 'Neighbor Full password=hidden-value', exitCode: 0 }; } },
    audit: { record: async event => events.push(event) }
  });
  const result = await verifier.run(check, { actor: author, instance });
  assert.equal(result.passed, true);
  assert.match(result.evidence.output, /password=\[REDACTED\]/);
  assert.equal(calls[0].instanceId, 'instance-1');
  assert.deepEqual(calls[0].argv, check.argv);
  assert.deepEqual(calls[0].limits, check.limits);
  assert.equal(events[0].action, 'scenario.guest-command.run');
  assert.doesNotMatch(JSON.stringify(events), /hidden-value/);
});

test('rejects non-authors, shell strings, host targets, module paths, uninstalled plugins, unqualified transports, and foreign VM targets', async () => {
  const base = { transport: { qualified: true, execute: async () => ({ output: '', exitCode: 0 }) }, installedPlugins: new Set(['safe-plugin']) };
  const verifier = new GuestCommandCheck(base);
  await assert.rejects(verifier.run(check, { actor: { id: 'student-1', role: 'student' }, instance }), error => error.code === 'FORBIDDEN');
  await assert.rejects(verifier.run({ ...check, argv: 'vtysh -c show' }, { actor: author, instance }), error => error.code === 'INVALID_COMMAND');
  await assert.rejects(verifier.run({ ...check, targetVm: 'host' }, { actor: author, instance }), error => error.code === 'INVALID_TARGET');
  await assert.rejects(verifier.run({ ...check, module: '/tmp/evil.js' }, { actor: author, instance }), error => error.code === 'INVALID_PLUGIN');
  await assert.rejects(verifier.run({ ...check, plugin: 'missing-plugin' }, { actor: author, instance }), error => error.code === 'PLUGIN_NOT_INSTALLED');
  await assert.rejects(new GuestCommandCheck({ transport: { qualified: false, execute: async () => ({}) } }).run(check, { actor: author, instance }), error => error.code === 'TRANSPORT_UNQUALIFIED');
  await assert.rejects(verifier.run({ ...check, targetVm: 'node-r2' }, { actor: author, instance }), error => error.code === 'INSTANCE_OWNERSHIP_REQUIRED');
});

test('bounds guest output and rejects unsafe limits before the transport executes', async () => {
  let calls = 0;
  const verifier = new GuestCommandCheck({ transport: { qualified: true, execute: async () => { calls += 1; return { output: 'x'.repeat(1000), exitCode: 0 }; } } });
  const result = await verifier.run({ ...check, limits: { timeoutMs: 20, maxOutputBytes: 12, cpuMs: 10 } }, { actor: author, instance });
  assert.equal(result.evidence.output.length, 12);
  await assert.rejects(verifier.run({ ...check, limits: { timeoutMs: 999999, maxOutputBytes: 12, cpuMs: 10 } }, { actor: author, instance }), error => error.code === 'INVALID_LIMITS');
  assert.equal(calls, 1);
});
