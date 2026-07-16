const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const path = require('node:path');
const test = require('node:test');
const {
  CapsuleValidationError,
  capsuleHash,
  convertLegacyTopology,
  normalizeCapsule,
  validateCapsule
} = require('../modules/capsuleSchema');

const fixturePath = path.join(__dirname, 'fixtures', 'capsules', 'basic-routing.json');

test('valid capsule normalizes to a stable, digest-pinned document', async () => {
  const capsule = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const normalized = normalizeCapsule(capsule, { requireDigests: true });

  assert.equal(normalized.kind, 'LabCapsule');
  assert.deepEqual(Object.keys(normalized.nodes), ['client', 'r1', 'r2']);
  assert.deepEqual(normalized.links.map(link => link.id), ['client-lan', 'transit']);
  assert.equal(normalized.links[0].endpoints[0].node, 'r1');
  assert.match(capsuleHash(normalized), /^sha256:[a-f0-9]{64}$/);
});

test('validation rejects unresolved image digests before planning', async () => {
  const capsule = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  delete capsule.images.router.digest;

  const result = validateCapsule(capsule, { requireDigests: true });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.path === 'images.router.digest'));
  assert.throws(() => normalizeCapsule(capsule, { requireDigests: true }), CapsuleValidationError);
});

test('legacy topology conversion preserves explicit links and reports unresolved images', () => {
  const result = convertLegacyTopology({
    nodes: [
      { id: 'router-a', name: 'Border router', osType: 'router', data: { vcpus: 2, memoryMb: 2048 } },
      { id: 'host-a', name: 'Workstation', osType: 'ubuntu', position: { x: 10, y: 20 } }
    ],
    edges: [{ id: 'edge-a', source: 'router-a', target: 'host-a', sourceInterface: 'ge0', targetInterface: 'eth0' }]
  }, { name: 'Legacy lab' });

  assert.equal(result.capsule.metadata.displayName, 'Legacy lab');
  assert.deepEqual(result.capsule.links[0].endpoints, [
    { node: 'router-a', interface: 'ge0' },
    { node: 'host-a', interface: 'eth0' }
  ]);
  assert.equal(result.requiresImageResolution, true);
  assert.ok(result.warnings.some(warning => warning.code === 'IMAGE_DIGEST_REQUIRED'));
});

test('display metadata and presentation changes do not change semantic normalization', async () => {
  const capsule = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const first = normalizeCapsule(capsule, { requireDigests: true });
  const secondInput = structuredClone(capsule);
  secondInput.metadata.displayName = 'A different display label';
  secondInput.nodes.r1.displayName = 'Core router';
  secondInput.nodes.r1.position = { x: 999, y: 999 };
  const second = normalizeCapsule(secondInput, { requireDigests: true });

  assert.notEqual(capsuleHash(first), capsuleHash(second));
  assert.deepEqual(first.nodes.r1.interfaces, second.nodes.r1.interfaces);
});

