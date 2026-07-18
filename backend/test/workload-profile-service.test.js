'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  WorkloadProfileService,
  validateNodeOverrides,
} = require('../services/workloadProfileService');
const { MemoryWorkloadProfileRepository } = require('../repositories/workloadProfileRepository');

function profile() {
  return {
    id: 'qemu-router',
    version: 'draft',
    architecture: 'x86_64',
    acceleration: ['kvm'],
    machine: 'q35',
    firmware: 'uefi',
    console: 'serial',
    consoles: ['serial', 'vnc'],
    resources: { minVcpus: 1, maxVcpus: 4, minMemoryMiB: 512, maxMemoryMiB: 8192 },
    interfaces: { max: 4, models: ['virtio-net'] },
    disks: { max: 2, formats: ['qcow2'] },
    capabilities: { bootstrap: true, readiness: true, capture: true, checkpoint: true, hotPlug: false },
    supportedImage: { architectures: ['x86_64'], formats: ['qcow2'] },
    permittedNodeOverrides: ['resources.vcpus', 'resources.memoryMiB', 'console.type'],
  };
}

test('publishes immutable workload profile versions with capability metadata', async () => {
  const service = new WorkloadProfileService({ repository: new MemoryWorkloadProfileRepository() });
  const version = await service.publish(profile());
  assert.equal(version.versionNumber, 1);
  assert.deepEqual(version.capabilities, profile().capabilities);
  await assert.rejects(service.publish(profile()), error => error.code === 'DUPLICATE_CONTENT');
  assert.deepEqual(await service.resolveWorkloadProfileVersion(version.id), version);
});

test('only permits declared node overrides within profile resource bounds', () => {
  const result = validateNodeOverrides(profile(), { resources: { vcpus: 2, memoryMiB: 2048 }, console: { type: 'serial' } });
  assert.deepEqual(result, { resources: { vcpus: 2, memoryMiB: 2048 }, console: { type: 'serial' } });
  assert.throws(() => validateNodeOverrides(profile(), { resources: { vcpus: 8 } }), error => error.code === 'INVALID_NODE_OVERRIDES');
  assert.throws(() => validateNodeOverrides(profile(), { interfaces: [{ id: 'eth0' }] }), error => error.code === 'INVALID_NODE_OVERRIDES');
});
