'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AdmissionService, AdmissionError } = require('../services/admissionService');
const { MemoryReservationRepository } = require('../repositories/reservationRepository');

function plan(instanceId, resources = { vcpus: 2, memoryMiB: 2048, storageGiB: 16 }) {
  return { instanceId, resources, interfaces: [{ tap: `tap-${instanceId}`, mac: '02:00:00:00:00:01' }], segments: [{ id: 'segment', resourceKey: `${instanceId}|segment` }], consoles: [{ port: 5900 }], ownership: { hostId: 'host-a' } };
}
function service() { return new AdmissionService({ reservations: new MemoryReservationRepository() }); }
const host = { id: 'host-a', capabilities: ['kvm'], capacity: { vcpus: 3, memoryMiB: 4096, storageGiB: 32, consolePorts: 2, interfaces: 8, segments: 8 } };

test('admits without CPU, memory, storage, or allocation overcommit', async () => {
  const admissions = service();
  await admissions.admit({ plan: plan('one'), host, requiredCapabilities: ['kvm'] });
  await assert.rejects(admissions.admit({ plan: plan('two'), host, requiredCapabilities: ['kvm'] }), error => error instanceof AdmissionError && error.code === 'INSUFFICIENT_VCPU_CAPACITY');
  await assert.rejects(admissions.admit({ plan: plan('big-storage', { vcpus: 1, memoryMiB: 512, storageGiB: 17 }), host, requiredCapabilities: ['kvm'] }), error => error instanceof AdmissionError && error.code === 'INSUFFICIENT_STORAGE_CAPACITY');
  await assert.rejects(admissions.admit({ plan: plan('no-kvm'), host: { ...host, capabilities: [] }, requiredCapabilities: ['kvm'] }), error => error instanceof AdmissionError && error.code === 'HOST_CAPABILITY_UNSUPPORTED');
});

test('serializes concurrent reservations and releases active resources for stopped instances', async () => {
  const admissions = service();
  const concurrent = await Promise.allSettled([admissions.admit({ plan: plan('one'), host }), admissions.admit({ plan: plan('two'), host })]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  await admissions.releaseForStoppedInstance(concurrent.find(result => result.status === 'fulfilled').value.instanceId);
  const result = await admissions.admit({ plan: plan('three'), host });
  assert.equal(result.instanceId, 'three');
});
