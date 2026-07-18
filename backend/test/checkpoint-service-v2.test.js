'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CheckpointService, CheckpointError } = require('../services/checkpointService');

test('CheckpointService stages digest-verified multi-node copies and cleans partial failures', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sandlabx-checkpoint-v2-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const overlays = path.join(root, 'overlays'); await fs.mkdir(overlays); const a = path.join(overlays, 'a.qcow2'); const b = path.join(overlays, 'b.qcow2'); await fs.writeFile(a, 'node-a'); await fs.writeFile(b, 'node-b');
  const service = new CheckpointService({ root: path.join(root, 'checkpoints'), overlayRoot: overlays, quotaBytes: 100 }); const instance = { id: 'instance-a', ownerId: 'user-a', state: 'STOPPED', name: 'training' };
  const checkpoint = await service.create(instance, 'user-a', [{ nodeId: 'a', overlayPath: a }, { nodeId: 'b', overlayPath: b }], { idempotencyKey: 'checkpoint-1' });
  assert.equal(checkpoint.nodes.length, 2); assert.equal((await service.create(instance, 'user-a', [{ nodeId: 'a', overlayPath: a }, { nodeId: 'b', overlayPath: b }], { idempotencyKey: 'checkpoint-1' })).id, checkpoint.id);
  await fs.writeFile(a, 'changed'); await service.restore(instance, 'user-a', checkpoint.id); assert.equal(await fs.readFile(a, 'utf8'), 'node-a');
  await fs.writeFile(path.join(overlays, 'huge.qcow2'), 'x'.repeat(101)); await assert.rejects(service.create(instance, 'user-a', [{ nodeId: 'huge', overlayPath: path.join(overlays, 'huge.qcow2') }]), CheckpointError);
  await assert.rejects(service.create({ ...instance, state: 'RUNNING' }, 'user-a', [{ nodeId: 'a', overlayPath: a }]), CheckpointError);
});
