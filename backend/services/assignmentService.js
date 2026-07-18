'use strict';
const immutable = value => Object.freeze(structuredClone(value));
const error = (message, code) => Object.assign(new Error(message), { code });
const actorId = actor => actor?.id || actor?.sub;
function requireInstructor(actor) { if (!actorId(actor)) throw error('Authentication is required', 'UNAUTHORIZED'); if (!['admin', 'instructor'].includes(actor.role)) throw error('Assignment management requires instructor access', 'FORBIDDEN'); }
class AssignmentService {
  constructor({ repository, capsuleVersions, scenarioVersions }) { if (!repository || !capsuleVersions || !scenarioVersions) throw new TypeError('repository, capsuleVersions, and scenarioVersions are required'); this.repository = repository; this.capsuleVersions = capsuleVersions; this.scenarioVersions = scenarioVersions; }
  async createAssignment(actor, input) {
    requireInstructor(actor);
    return this.repository.transaction(async client => {
      const [capsule, scenario] = await Promise.all([this.capsuleVersions.get(input.capsuleVersionId, client), this.scenarioVersions.get(input.scenarioVersionId, client)]);
      if (!capsule || !scenario) throw error('Assignment requires published immutable versions', 'VERSION_NOT_FOUND');
      if (scenario.capsuleVersionId !== capsule.id) throw error('Scenario is not compatible with Capsule version', 'SCENARIO_CAPSULE_MISMATCH');
      const assignment = await this.repository.create({ ownerId: actorId(actor), name: input.name, capsuleVersionId: capsule.id, scenarioVersionId: scenario.id }, client);
      for (const memberId of new Set(input.memberIds || [])) await this.repository.addMember(assignment.id, memberId, 'student', client);
      return immutable(assignment);
    });
  }
  async canAccessAssignment(actor, assignmentId) { const assignment = await this.repository.get(assignmentId); if (!assignment) return false; if (actor?.role === 'admin' || assignment.ownerId === actorId(actor)) return true; return Boolean(await this.repository.memberRole(assignmentId, actorId(actor))); }
  async grantInstructorObserver(actor, assignmentId, instructorId) { requireInstructor(actor); const assignment = await this.repository.get(assignmentId); if (!assignment) throw error('Assignment not found', 'NOT_FOUND'); if (actor.role !== 'admin' && assignment.ownerId !== actorId(actor)) throw error('Assignment access denied', 'FORBIDDEN'); await this.repository.addMember(assignmentId, instructorId, 'instructor-observer'); }
  async canObserveInstance(actor, assignmentId) { const assignment = await this.repository.get(assignmentId); if (!assignment) return false; return actor?.role === 'admin' || assignment.ownerId === actorId(actor) || (actor?.role === 'instructor' && await this.repository.memberRole(assignmentId, actorId(actor)) === 'instructor-observer'); }
}
module.exports = { AssignmentService };
