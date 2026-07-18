'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ScenarioRunService } = require('../services/verificationService');

const scenarioVersion = {
  id: 'scenario-v1', capsuleVersionId: 'capsule-v1', document: {
    metadata: { name: 'ospf-failure-recovery' },
    spec: { capsuleVersion: 'capsule-v1', attemptPolicy: { maxAttempts: 2 } },
    stages: [
      { id: 'inspect', checks: [{ id: 'r1-ready', type: 'nodeReadiness', node: 'r1', expected: { state: 'RUNNING' }, score: 2 }] },
      { id: 'recover', checks: [{ id: 'adjacency', type: 'serialOutput', node: 'r1', expected: { contains: 'FULL' }, hint: 'Repair the transit link.', score: 3 }] }
    ]
  }
};
const assignment = { id: 'assignment-1', capsuleVersionId: 'capsule-v1', scenarioVersionId: 'scenario-v1' };
const instance = { id: 'instance-1', ownerId: 'student-1', capsuleVersionId: 'capsule-v1', nodes: [{ id: 'node-r1', name: 'r1' }] };

test('runs exact-version scenario attempts in authored stage order with scores and redacted evidence', async () => {
  const service = new ScenarioRunService();
  const result = await service.run({ actor: { id: 'student-1', role: 'student' }, assignment, instance, scenarioVersion }, {
    nodes: { r1: { state: 'RUNNING' } },
    readSerial: async () => 'OSPF FULL token=private-value'
  });
  assert.equal(result.status, 'PASSED');
  assert.equal(result.score, 5);
  assert.equal(result.maximumScore, 5);
  assert.deepEqual(result.stages.map(stage => stage.id), ['inspect', 'recover']);
  assert.doesNotMatch(JSON.stringify(result), /private-value/);
  assert.equal(result.evidence.length, 2);
});

test('halts subsequent stages after a failed stage and records a bounded attempt result', async () => {
  const service = new ScenarioRunService();
  const result = await service.run({ actor: { id: 'student-1', role: 'student' }, assignment, instance, scenarioVersion }, {
    nodes: { r1: { state: 'STOPPED' } }, readSerial: async () => 'OSPF FULL'
  });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.stages[0].status, 'FAILED');
  assert.equal(result.stages[1].status, 'SKIPPED');
  assert.equal(result.score, 0);
  assert.equal(service.attemptsFor('assignment-1', 'student-1').length, 1);
});

test('requires exact assignment, scenario, instance ownership, and enforces attempt policy', async () => {
  const service = new ScenarioRunService();
  const input = { actor: { id: 'student-1', role: 'student' }, assignment, instance, scenarioVersion };
  await assert.rejects(service.run({ ...input, assignment: { ...assignment, scenarioVersionId: 'scenario-v2' } }, {}), error => error.code === 'VERSION_PIN_MISMATCH');
  await assert.rejects(service.run({ ...input, instance: { ...instance, ownerId: 'student-2' } }, {}), error => error.code === 'INSTANCE_OWNERSHIP_REQUIRED');
  await service.run(input, { nodes: { r1: { state: 'RUNNING' } }, readSerial: async () => 'FULL' });
  await service.run(input, { nodes: { r1: { state: 'RUNNING' } }, readSerial: async () => 'FULL' });
  await assert.rejects(service.run(input, { nodes: { r1: { state: 'RUNNING' } }, readSerial: async () => 'FULL' }), error => error.code === 'ATTEMPT_LIMIT_REACHED');
});
