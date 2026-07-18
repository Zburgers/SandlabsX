'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { MemoryCapsuleRepository } = require('../repositories/capsuleRepository');
const { CapsuleService } = require('../services/capsuleService');

const owner = { id: 'instructor-a', role: 'instructor' };
const digest = `sha256:${'a'.repeat(64)}`;

function capsule(name = 'routing-lab') {
  return {
    apiVersion: 'sandlabx.io/v1alpha1', kind: 'LabCapsule', metadata: { name, displayName: name },
    runtime: { architecture: 'x86_64' }, policy: { network: { internetEgress: false } },
    images: { router: { version: 'image-v1', digest } },
    workloadProfiles: { router: { version: 'profile-v1' } },
    nodes: { r1: { driver: 'qemu', image: 'router', workloadProfile: 'router', interfaces: [{ id: 'eth0' }] } }, links: [],
  };
}

test('CapsuleService updates drafts with optimistic concurrency', async () => {
  const service = new CapsuleService({ repository: new MemoryCapsuleRepository() });
  const draft = await service.createDraft(owner, capsule());
  const updated = await service.updateDraft(owner, draft.id, 1, { metadata: { ...draft.document.metadata, description: 'updated' } });
  assert.equal(updated.revision, 2);
  await assert.rejects(service.updateDraft(owner, draft.id, 1, {}), error => error.code === 'REVISION_CONFLICT');
});

test('CapsuleService freezes private and published versions without mutating prior revisions', async () => {
  const service = new CapsuleService({ repository: new MemoryCapsuleRepository() });
  const draft = await service.createDraft(owner, capsule());
  const privateVersion = await service.createPrivateRevision(owner, draft.id);
  const published = await service.publish(owner, draft.id);
  await service.updateDraft(owner, draft.id, draft.revision, { metadata: { ...draft.document.metadata, description: 'new draft' } });
  assert.equal(privateVersion.visibility, 'PRIVATE');
  assert.equal(published.visibility, 'PUBLISHED');
  assert.equal((await service.getVersion(owner, published.id)).document.metadata.description, undefined);
});

test('CapsuleService rejects invalid publication and duplicate semantic digests', async () => {
  const service = new CapsuleService({ repository: new MemoryCapsuleRepository() });
  const invalid = await service.createDraft(owner, { ...capsule('invalid-lab'), images: { router: { version: 'image-v1' } } });
  await assert.rejects(service.publish(owner, invalid.id), error => error.code === 'INVALID_CAPSULE');
  const draft = await service.createDraft(owner, capsule('deduplicated-lab'));
  const first = await service.publish(owner, draft.id);
  const second = await service.publish(owner, draft.id);
  assert.equal(second.id, first.id);
});

test('CapsuleService restricts authoring to admins and instructors', async () => {
  const service = new CapsuleService({ repository: new MemoryCapsuleRepository() });
  await assert.rejects(service.createDraft({ id: 'student-a', role: 'student' }, capsule()), error => error.code === 'FORBIDDEN');
});
