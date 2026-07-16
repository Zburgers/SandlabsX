const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const path = require('node:path');
const test = require('node:test');
const { normalizeCapsule } = require('../modules/capsuleSchema');
const { compilePlan, PlanCompilationError } = require('../modules/planCompiler');

async function fixture() {
  return normalizeCapsule(JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures/capsules/basic-routing.json'), 'utf8')), { requireDigests: true });
}

const options = {
  instanceId: 'instance-a',
  imagePaths: { router: '/images/router.qcow2', ubuntu: '/images/ubuntu.qcow2' },
  overlaysRoot: '/overlays',
  hostCapabilities: { architecture: 'x86_64', acceleration: 'kvm', maxVcpus: 8, maxMemoryMiB: 8192, vncPortStart: 5900 }
};

test('compiler creates a deterministic plan from declared links and safe QEMU argv', async () => {
  const capsule = await fixture();
  const first = compilePlan(capsule, options);
  const second = compilePlan(capsule, options);

  assert.deepEqual(first, second);
  assert.match(first.planHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.nodes.length, 3);
  assert.equal(first.network.segments.length, 2);
  assert.equal(first.network.interfaces.length, 4);
  assert.equal(new Set(first.network.interfaces.map(nic => nic.mac)).size, 4);
  assert.equal(new Set(first.network.interfaces.map(nic => nic.tap)).size, 4);
  assert.ok(first.nodes.every(node => Array.isArray(node.process.args) && !node.process.args.join(' ').includes('PC1')));
  assert.ok(first.nodes.every(node => node.disk.overlayPath.startsWith('/overlays/instance-a/')));
});

test('presentation and display labels do not affect the execution plan, but declared link changes do', async () => {
  const capsule = await fixture();
  const first = compilePlan(capsule, options);
  const presentationOnly = structuredClone(capsule);
  presentationOnly.metadata.displayName = 'Changed label';
  presentationOnly.nodes.r1.displayName = 'Changed node label';
  presentationOnly.nodes.r1.presentation.position = { x: 999, y: 999 };
  assert.deepEqual(compilePlan(presentationOnly, options), first);

  const rewired = structuredClone(capsule);
  rewired.links[0].endpoints.reverse();
  assert.notEqual(compilePlan(rewired, options).planHash, first.planHash);
});

test('compiler rejects unsupported host capacity and unresolved image paths before allocation', async () => {
  const capsule = await fixture();
  assert.throws(() => compilePlan(capsule, { ...options, hostCapabilities: { ...options.hostCapabilities, maxVcpus: 2 } }), error => error instanceof PlanCompilationError && error.code === 'INSUFFICIENT_CAPACITY');
  assert.throws(() => compilePlan(capsule, { ...options, imagePaths: {} }), error => error instanceof PlanCompilationError && error.code === 'IMAGE_PATH_MISSING');
});
