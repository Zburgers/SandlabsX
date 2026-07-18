'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { compileExecutionPlan, PlanCompilationError } = require('../planning/planCompiler');

function capsule() {
  return {
    apiVersion: 'sandlabx.io/v1alpha1', kind: 'LabCapsule',
    metadata: { name: 'routing-lab', displayName: 'Routing Lab' },
    runtime: { architecture: 'x86_64', isolation: 'private' },
    policy: { resources: { maxVcpus: 8, maxMemoryMiB: 8192, maxDiskGiB: 64 }, network: { internetEgress: false } },
    images: { router: { name: 'router', digest: `sha256:${'a'.repeat(64)}` } },
    workloadProfiles: { router: { version: 'profile-router-v1' } },
    nodes: {
      r1: { driver: 'qemu-serial-router', image: 'router', workloadProfile: 'router', resources: { vcpus: 1, memoryMiB: 1024, diskGiB: 8 }, interfaces: [{ id: 'ge0' }, { id: 'ge1' }], console: { type: 'serial' } },
      r2: { driver: 'qemu-serial-router', image: 'router', workloadProfile: 'router', resources: { vcpus: 1, memoryMiB: 1024, diskGiB: 8 }, interfaces: [{ id: 'ge0' }, { id: 'ge1' }], console: { type: 'serial' } },
      client: { driver: 'qemu-linux-cloud', image: 'router', workloadProfile: 'router', resources: { vcpus: 1, memoryMiB: 1024, diskGiB: 8 }, interfaces: [{ id: 'eth0' }, { id: 'eth1' }], console: { type: 'vnc' } },
    },
    links: [
      { id: 'transit', type: 'pointToPoint', endpoints: ['r1:ge0', 'r2:ge0'] },
      { id: 'lan', type: 'segment', endpoints: ['r1:ge1', 'r2:ge1', 'client:eth0'] },
    ],
  };
}

const options = {
  instanceId: 'instance-123', capsuleVersion: { id: 'capsule-v1', contentHash: `sha256:${'b'.repeat(64)}` },
  host: { id: 'host-a', architecture: 'x86_64', acceleration: ['kvm'], vncPortStart: 5900, vncPortEnd: 5910 },
  imageVersions: { router: { id: 'image-router-v1', digest: `sha256:${'a'.repeat(64)}`, storagePath: '/images/router.qcow2', format: 'qcow2', architecture: 'x86_64' } },
  workloadProfileVersions: { router: { id: 'profile-router-v1', architecture: 'x86_64', acceleration: ['kvm'], machine: 'q35', console: 'serial', consoles: ['serial', 'vnc'], resources: { minVcpus: 1, maxVcpus: 4, minMemoryMiB: 512, maxMemoryMiB: 4096 }, interfaces: { max: 4, models: ['virtio-net-pci'] }, disks: { max: 2, formats: ['qcow2'] } } },
  overlaysRoot: '/var/lib/sandlabx/overlays',
};

test('compiles an immutable deterministic plan with declared wiring only', () => {
  const first = compileExecutionPlan(capsule(), options);
  const presentationOnly = capsule(); presentationOnly.metadata.displayName = 'Different title'; presentationOnly.nodes.r1.displayName = 'Different node'; presentationOnly.nodes.r1.position = { x: 4, y: 8 };
  const second = compileExecutionPlan(presentationOnly, options);
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.semanticHash, second.semanticHash);
  assert.equal(first.fullHash, second.fullHash);
  assert.deepEqual(Object.keys(first).sort(), ['compensation', 'consoles', 'disks', 'fullHash', 'images', 'instanceId', 'interfaces', 'ownership', 'processes', 'readiness', 'resources', 'schemaVersion', 'segments', 'semanticHash', 'steps']);
  assert.equal(first.segments.filter(segment => segment.type === 'pointToPoint').length, 1);
  assert.equal(first.segments.find(segment => segment.id === 'lan').endpoints.length, 3);
  const unwired = first.interfaces.find(nic => nic.nodeId === 'client' && nic.interfaceId === 'eth1');
  assert.equal(unwired.segmentId, null);
  assert.equal(first.interfaces.filter(nic => nic.segmentId).length, 5);
  assert.ok(first.processes.every(process => Array.isArray(process.args)));
  assert.ok(first.interfaces.every(nic => nic.tap.length <= 15 && nic.netdev.length <= 31));
  assert.ok(first.processes.every(process => !process.args.join(' ').includes('Routing Lab')));
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/plans/routing-lab-v2.json'), 'utf8'));
  assert.deepEqual(fixture, first);
});

test('requires exact resolved image and profile versions and stable host capability errors', () => {
  assert.throws(() => compileExecutionPlan(capsule(), { ...options, imageVersions: {} }), error => error instanceof PlanCompilationError && error.code === 'IMAGE_VERSION_NOT_FOUND');
  assert.throws(() => compileExecutionPlan(capsule(), { ...options, workloadProfileVersions: {} }), error => error instanceof PlanCompilationError && error.code === 'WORKLOAD_PROFILE_VERSION_NOT_FOUND');
  assert.throws(() => compileExecutionPlan(capsule(), { ...options, host: { ...options.host, acceleration: ['tcg'] } }), error => error instanceof PlanCompilationError && error.code === 'HOST_CAPABILITY_UNSUPPORTED');
});

module.exports = { capsule, options };
