'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MemoryAssignmentRepository } = require('../repositories/assignmentRepository');
const { AssignmentService } = require('../services/assignmentService');

const instructor = { id: 'instructor-a', role: 'instructor' };

test('AssignmentService pins compatible immutable versions and grants assignees access', async () => {
  const service = new AssignmentService({ repository: new MemoryAssignmentRepository(), capsuleVersions: { get: async id => id === 'capsule-v1' ? { id } : null }, scenarioVersions: { get: async id => id === 'scenario-v1' ? { id, capsuleVersionId: 'capsule-v1' } : null } });
  const assignment = await service.createAssignment(instructor, { name: 'week-one', capsuleVersionId: 'capsule-v1', scenarioVersionId: 'scenario-v1', memberIds: ['student-a'] });
  assert.equal(assignment.capsuleVersionId, 'capsule-v1');
  assert.equal(await service.canAccessAssignment({ id: 'student-a', role: 'student' }, assignment.id), true);
  assert.equal(await service.canAccessAssignment({ id: 'student-b', role: 'student' }, assignment.id), false);
  assert.deepEqual((await service.listAssignments({ id: 'student-a', role: 'student' })).map(item => item.id), [assignment.id]);
  assert.equal((await service.listAssignments({ id: 'student-b', role: 'student' })).length, 0);
});

test('AssignmentService permits explicitly granted instructor observers only', async () => {
  const repository = new MemoryAssignmentRepository();
  const service = new AssignmentService({ repository, capsuleVersions: { get: async () => ({ id: 'capsule-v1' }) }, scenarioVersions: { get: async () => ({ id: 'scenario-v1', capsuleVersionId: 'capsule-v1' }) } });
  const assignment = await service.createAssignment(instructor, { name: 'observe', capsuleVersionId: 'capsule-v1', scenarioVersionId: 'scenario-v1' });
  assert.equal(await service.canObserveInstance({ id: 'other-instructor', role: 'instructor' }, assignment.id, 'student-a'), false);
  await service.grantInstructorObserver(instructor, assignment.id, 'other-instructor');
  assert.equal(await service.canObserveInstance({ id: 'other-instructor', role: 'instructor' }, assignment.id, 'student-a'), true);
});
