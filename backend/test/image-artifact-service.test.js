'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { ImageArtifactService } = require('../services/imageArtifactService');
const { MemoryImageArtifactRepository } = require('../repositories/imageArtifactRepository');
const { WorkloadProfileService } = require('../services/workloadProfileService');
const { MemoryWorkloadProfileRepository } = require('../repositories/workloadProfileRepository');

function profile() {
  return {
    id: 'qemu-router', version: 'draft', console: 'serial', architecture: 'x86_64', acceleration: ['kvm'], machine: 'q35',
    resources: { minVcpus: 1, maxVcpus: 4, minMemoryMiB: 512, maxMemoryMiB: 8192 },
    interfaces: { max: 4, models: ['virtio-net'] }, disks: { max: 2, formats: ['qcow2'] },
    capabilities: { capture: true }, supportedImage: { architectures: ['x86_64'], formats: ['qcow2'] },
    permittedNodeOverrides: [],
  };
}

test('publishes immutable image versions with digest identity and provenance', async () => {
  const service = new ImageArtifactService({ repository: new MemoryImageArtifactRepository() });
  const version = await service.publish({
    name: 'router-base', digest: `sha256:${'a'.repeat(64)}`, format: 'qcow2', storagePath: '/images/router.qcow2',
    sizeBytes: 42, architecture: 'x86_64', provenance: { kind: 'IMPORT', source: 'router.vmdk' },
  });
  assert.equal(version.versionNumber, 1);
  assert.deepEqual(version.provenance, { kind: 'IMPORT', source: 'router.vmdk' });
  const second = await service.publish({
    name: 'router-base', digest: `sha256:${'c'.repeat(64)}`, format: 'qcow2', storagePath: '/images/router-v2.qcow2',
    sizeBytes: 84, architecture: 'x86_64', provenance: { kind: 'IMPORT', source: 'router-v2.vmdk' },
  });
  assert.equal(second.versionNumber, 2);
  await assert.rejects(service.publish({ ...version, storagePath: '/images/duplicate.qcow2' }), error => error.code === 'DUPLICATE_DIGEST');
  assert.deepEqual(await service.resolveImageVersion(version.id), version);
});

test('rejects incompatible image/profile and unavailable host capabilities', async () => {
  const images = new ImageArtifactService({ repository: new MemoryImageArtifactRepository() });
  const profiles = new WorkloadProfileService({ repository: new MemoryWorkloadProfileRepository() });
  const image = await images.publish({ name: 'router-base', digest: `sha256:${'b'.repeat(64)}`, format: 'qcow2', storagePath: '/images/router.qcow2', sizeBytes: 42, architecture: 'x86_64', provenance: { kind: 'IMPORT', source: 'router.vmdk' } });
  const workload = await profiles.publish(profile());
  assert.equal(images.assertImageCompatibility(image, workload, { architecture: 'x86_64', acceleration: ['kvm'] }), true);
  assert.throws(() => images.assertImageCompatibility({ ...image, format: 'raw' }, workload, { architecture: 'x86_64', acceleration: ['kvm'] }), error => error.code === 'IMAGE_PROFILE_INCOMPATIBLE');
  assert.throws(() => images.assertImageCompatibility(image, workload, { architecture: 'x86_64', acceleration: ['tcg'] }), error => error.code === 'HOST_CAPABILITY_UNSUPPORTED');
});

test('requires stopped owned overlays and capacity before capture', async () => {
  const service = new ImageArtifactService({ repository: new MemoryImageArtifactRepository() });
  await assert.rejects(service.capture({ instance: { state: 'RUNNING', ownerId: 'user-a' }, node: { ownerId: 'user-a', overlayPath: '/overlays/r1.qcow2' }, ownerId: 'user-a' }), error => error.code === 'INSTANCE_NOT_STOPPED');
  await assert.rejects(service.capture({ instance: { state: 'STOPPED', ownerId: 'user-a' }, node: { ownerId: 'user-b', overlayPath: '/overlays/r1.qcow2' }, ownerId: 'user-a' }), error => error.code === 'OVERLAY_NOT_OWNED');
});
