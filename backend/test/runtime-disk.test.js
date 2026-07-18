'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DiskService, OwnershipError } = require('../runtime/diskService');

test('DiskService publishes a staged owned overlay atomically and refuses paths outside its root', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sandlabx-disk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const base = path.join(root, 'base.qcow2'); await fs.writeFile(base, 'base');
  const calls = [];
  const service = new DiskService({ root: path.join(root, 'overlays'), runner: { run: async (command, args) => { calls.push([command, args]); await fs.writeFile(args.at(-1), 'overlay'); return { code: 0, stdout: '' }; } } });
  const overlay = await service.createOverlay({ instanceId: 'instance-a', nodeId: 'router-1', baseImage: base, overlayPath: path.join(root, 'overlays', 'instance-a', 'router-1.qcow2') });
  assert.equal(overlay.ownership.instanceId, 'instance-a');
  assert.equal(calls[0][0], 'qemu-img');
  assert.ok((await fs.stat(overlay.path)).isFile());
  await assert.rejects(service.createOverlay({ instanceId: 'instance-a', nodeId: 'router-1', baseImage: base, overlayPath: path.join(root, 'escape.qcow2') }), OwnershipError);
  await assert.rejects(service.removeOverlay(overlay, { instanceId: 'other', nodeId: 'router-1' }), OwnershipError);
  await service.removeOverlay(overlay, overlay.ownership);
  await assert.rejects(fs.stat(overlay.path));
});
