'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { DestructiveActionService, DestructiveActionError } = require('../services/destructiveActionService');

test('DestructiveActionService requires a fresh typed confirmation and is idempotent', async () => {
  let now = 1000; const service = new DestructiveActionService({ secret: 'test-secret', now: () => now }); const instance = { id: 'instance-a', name: 'network-training', ownerId: 'user-a', revision: 4, state: 'STOPPED' };
  const preview = service.createImpactToken(instance, 'DESTROY');
  assert.equal(service.authorize({ instance, actorId: 'user-a', action: 'DESTROY', expectedName: 'network-training', expectedRevision: 4, impactToken: preview }).id, instance.id);
  assert.throws(() => service.authorize({ instance, actorId: 'user-a', action: 'DESTROY', expectedName: 'wrong', expectedRevision: 4, impactToken: preview }), DestructiveActionError);
  now += 61_000; assert.throws(() => service.authorize({ instance, actorId: 'user-a', action: 'DESTROY', expectedName: 'network-training', expectedRevision: 4, impactToken: preview }), DestructiveActionError);
});
