'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MemoryScenarioRepository } = require('../repositories/scenarioRepository');
const { ScenarioService } = require('../services/scenarioService');

const instructor = { id: 'instructor-a', role: 'instructor' };
function scenario(capsuleVersionId = 'capsule-v1') { return { apiVersion: 'sandlabx.io/v1alpha1', kind: 'LabScenario', metadata: { name: 'routing-check' }, spec: { capsuleVersion: capsuleVersionId }, stages: [{ id: 'verify', checks: [] }] }; }

test('ScenarioService publishes only against an exact compatible Capsule version', async () => {
  const service = new ScenarioService({ repository: new MemoryScenarioRepository(), capsuleVersions: { get: async id => id === 'capsule-v1' ? { id, document: { nodes: {} } } : null } });
  const draft = await service.createDraft(instructor, scenario());
  const version = await service.publish(instructor, draft.id);
  assert.equal(version.capsuleVersionId, 'capsule-v1');
  assert.equal(version.visibility, 'PUBLISHED');
  const moving = await service.createDraft(instructor, scenario('latest'));
  await assert.rejects(service.publish(instructor, moving.id), error => error.code === 'INVALID_SCENARIO');
});

test('ScenarioService rollback leaves drafts intact when immutable publication fails', async () => {
  const repository = new MemoryScenarioRepository({ failPublication: true });
  const service = new ScenarioService({ repository, capsuleVersions: { get: async () => ({ id: 'capsule-v1', document: { nodes: {} } }) } });
  const draft = await service.createDraft(instructor, scenario());
  await assert.rejects(service.publish(instructor, draft.id), error => error.code === 'PUBLICATION_FAILED');
  assert.equal((await repository.getDraft(draft.id)).revision, 1);
  assert.equal((await repository.listVersions(draft.id)).length, 0);
});
