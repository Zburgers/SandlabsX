const assert = require('node:assert/strict');
const test = require('node:test');
const { MemoryCapsuleRepository } = require('../modules/capsuleRepository');
const { MemoryInstanceRepository } = require('../modules/instanceRepository');
const { MemoryOperationRepository } = require('../modules/operationRepository');

function capsule() {
  return {
    apiVersion: 'sandlabx.io/v1alpha1',
    kind: 'LabCapsule',
    metadata: { name: 'repository-test', displayName: 'Repository test' },
    images: { router: { name: 'router', digest: `sha256:${'1'.repeat(64)}` } },
    nodes: { r1: { driver: 'qemu-serial-router', image: 'router', interfaces: [{ id: 'ge0' }] } },
    links: [],
    scenarios: []
  };
}

test('draft updates use optimistic revisioning and published versions stay immutable', async () => {
  const repository = new MemoryCapsuleRepository();
  const draft = await repository.createDraft('user-a', capsule());
  const updated = await repository.updateDraft(draft.id, 'user-a', 1, { metadata: { ...capsule().metadata, description: 'updated' } });
  assert.equal(updated.revision, 2);
  await assert.rejects(repository.updateDraft(draft.id, 'user-a', 1, capsule()), error => error.code === 'REVISION_CONFLICT');

  const version = await repository.publish(draft.id, 'user-a');
  const exported = await repository.getVersion(version.id, 'user-a');
  assert.equal(exported.document.metadata.description, 'updated');
  await repository.updateDraft(draft.id, 'user-a', 2, capsule());
  const unchanged = await repository.getVersion(version.id, 'user-a');
  assert.equal(unchanged.document.metadata.description, 'updated');
});

test('instances point to one immutable version and reject cross-owner access', async () => {
  const capsules = new MemoryCapsuleRepository();
  const instances = new MemoryInstanceRepository({ capsules });
  const draft = await capsules.createDraft('owner-a', capsule());
  const version = await capsules.publish(draft.id, 'owner-a');
  const instance = await instances.create('owner-a', version.id, { name: 'exercise-1' });

  assert.equal(instance.capsuleVersionId, version.id);
  assert.equal(instance.state, 'STOPPED');
  assert.equal(await instances.get(instance.id, 'owner-b'), null);
});

test('operation idempotency returns the original operation for duplicate requests', async () => {
  const operations = new MemoryOperationRepository();
  const first = await operations.create({ ownerId: 'owner-a', type: 'START', resourceId: 'instance-a', idempotencyKey: 'start-1' });
  const duplicate = await operations.create({ ownerId: 'owner-a', type: 'START', resourceId: 'instance-a', idempotencyKey: 'start-1' });
  assert.equal(duplicate.id, first.id);
  assert.equal((await operations.listEvents(first.id)).length, 0);
  await operations.appendEvent(first.id, { type: 'STEP_STARTED', stepKey: 'plan' });
  assert.equal((await operations.listEvents(first.id))[0].stepKey, 'plan');
});
