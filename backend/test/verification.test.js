const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { VerificationError, VerificationRunner } = require('../modules/verificationRunner');
const { CheckpointError, CheckpointService } = require('../modules/checkpointService');

test('typed verification returns bounded evidence and redacts secrets', async () => {
  const runner = new VerificationRunner({ maxOutputBytes: 100 });
  const result = await runner.run({ id: 'scenario-1', checks: [
    { id: 'plan', type: 'topologyPlan', expected: { nodes: 2, links: 1 } },
    { id: 'serial', type: 'serialOutput', node: 'r1', expected: { contains: 'OSPF FULL' } }
  ] }, {
    plan: { nodes: [{ id: 'r1' }, { id: 'r2' }], network: { segments: [{ id: 'transit' }] } },
    readSerial: async () => 'OSPF FULL password=super-secret'
  });

  assert.equal(result.status, 'PASSED');
  assert.equal(result.results.length, 2);
  assert.match(result.results[1].evidence.output, /password=\[REDACTED\]/);
  assert.doesNotMatch(JSON.stringify(result), /super-secret/);
});

test('verification rejects arbitrary commands and path traversal', async () => {
  const runner = new VerificationRunner();
  await assert.rejects(runner.run({ checks: [{ id: 'unsafe', type: 'command', command: 'id' }] }, {}), error => error instanceof VerificationError && error.code === 'UNSUPPORTED_CHECK');
  await assert.rejects(runner.run({ checks: [{ id: 'escape', type: 'fileContains', path: '../secret', expected: { contains: 'x' } }] }, { artifactsRoot: '/tmp' }), error => error instanceof VerificationError && error.code === 'INVALID_ARTIFACT_PATH');
});

test('checkpoint create and restore require stopped instances and verify digests', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sandlabx-checkpoint-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const overlay = path.join(root, 'r1.qcow2');
  await fs.writeFile(overlay, 'before');
  const service = new CheckpointService({ root });
  const instance = { id: 'instance-1', state: 'STOPPED', ownerId: 'user-a' };
  const checkpoint = await service.create(instance, 'user-a', [{ nodeId: 'r1', overlayPath: overlay }], { name: 'clean' });
  await fs.writeFile(overlay, 'changed');
  const restored = await service.restore(instance, 'user-a', checkpoint.id);
  assert.equal(restored.state, 'RESTORED');
  assert.equal(await fs.readFile(overlay, 'utf8'), 'before');
  await assert.rejects(service.create({ ...instance, state: 'RUNNING' }, 'user-a', [{ nodeId: 'r1', overlayPath: overlay }]), error => error instanceof CheckpointError && error.code === 'INSTANCE_NOT_STOPPED');
});
