'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { normalizeScenario, validateScenario } = require('../domain/scenario');
test('Scenario is independent and pins an exact Capsule version', () => { const scenario = { kind: 'LabScenario', metadata: { name: 'ospf-recovery' }, spec: { capsuleVersion: 'capsule-v1' }, stages: [{ id: 'verify', checks: [] }] }; assert.equal(validateScenario(scenario, 'capsule-v1').length, 0); assert.ok(validateScenario(scenario, 'capsule-v2').length); assert.equal(normalizeScenario(scenario).kind, 'LabScenario'); });
test('Scenario publication validates node, interface, checkpoint, check target, and artifact references', () => {
  const scenario = { kind: 'LabScenario', metadata: { name: 'ospf-recovery' }, spec: { capsuleVersion: 'capsule-v1' }, stages: [{ id: 'verify', checkpoint: 'missing', checks: [{ target: 'r3:ge0', artifact: 'missing-artifact' }] }] };
  const context = { capsuleVersion: 'capsule-v1', nodes: { r1: ['ge0'] }, checkpoints: ['initial'], artifacts: ['topology'] };
  const issues = validateScenario(scenario, context); assert.ok(issues.some((issue) => issue.path.includes('checkpoint'))); assert.ok(issues.some((issue) => issue.path.includes('target'))); assert.ok(issues.some((issue) => issue.path.includes('artifact')));
});
