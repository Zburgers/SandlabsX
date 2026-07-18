'use strict';

const crypto = require('node:crypto');
const { TypedCheckRunner } = require('../verification/typedChecks');
const { GuestCommandCheck } = require('../verification/guestCommandCheck');

const fail = (message, code) => Object.assign(new Error(message), { code });
const actorId = actor => actor?.id || actor?.sub;

class ScenarioRunService {
  constructor({ runner, guestCommandCheck, audit } = {}) {
    this.attempts = new Map();
    this.audit = audit;
    this.runner = runner || new TypedCheckRunner();
    if (guestCommandCheck) this.runner.registry.register('guestCommand', (check, context) => guestCommandCheck.run(check, context));
  }
  attemptsFor(assignmentId, ownerId) { return (this.attempts.get(`${assignmentId}:${ownerId}`) || []).map(value => structuredClone(value)); }
  async run(input, context = {}) {
    const { actor, assignment, instance, scenarioVersion } = input || {};
    const ownerId = actorId(actor);
    this.validate({ ownerId, assignment, instance, scenarioVersion });
    const key = `${assignment.id}:${ownerId}`;
    const previous = this.attempts.get(key) || [];
    const maxAttempts = Number(scenarioVersion.document.spec?.attemptPolicy?.maxAttempts || 1);
    if (previous.length >= maxAttempts) throw fail('Scenario attempt limit reached', 'ATTEMPT_LIMIT_REACHED');
    const attempt = { id: crypto.randomUUID(), assignmentId: assignment.id, ownerId, instanceId: instance.id, capsuleVersionId: instance.capsuleVersionId, scenarioVersionId: scenarioVersion.id, status: 'ACTIVE', startedAt: new Date().toISOString(), stages: [], evidence: [] };
    for (const stage of scenarioVersion.document.stages || []) {
      if (attempt.stages.some(item => item.status !== 'PASSED')) { attempt.stages.push({ id: stage.id, status: 'SKIPPED', results: [] }); continue; }
      const result = await this.runner.runStage(stage, { ...context, actor, instance });
      const stageResult = { id: stage.id, status: result.status, score: result.score, maximumScore: result.maximumScore, results: result.results };
      attempt.stages.push(stageResult);
      attempt.evidence.push(...result.results.map(check => ({ stageId: stage.id, checkId: check.id, outcome: check.status, evidence: check.evidence })));
    }
    attempt.score = attempt.stages.reduce((total, stage) => total + (stage.score || 0), 0);
    attempt.maximumScore = attempt.stages.reduce((total, stage) => total + (stage.maximumScore || 0), 0);
    attempt.status = attempt.stages.every(stage => stage.status === 'PASSED') ? 'PASSED' : 'FAILED';
    attempt.finishedAt = new Date().toISOString();
    this.attempts.set(key, [...previous, attempt]);
    await this.audit?.record?.({ action: 'scenario.attempt.complete', actorId: ownerId, instanceId: instance.id, assignmentId: assignment.id, scenarioVersionId: scenarioVersion.id, outcome: attempt.status, metadata: { score: attempt.score, maximumScore: attempt.maximumScore } });
    return structuredClone(attempt);
  }
  validate({ ownerId, assignment, instance, scenarioVersion }) {
    if (!ownerId || !assignment || !instance || !scenarioVersion) throw fail('Actor, assignment, instance, and scenario version are required', 'INVALID_ATTEMPT');
    if (instance.ownerId !== ownerId) throw fail('Scenario attempts require an owned instance', 'INSTANCE_OWNERSHIP_REQUIRED');
    if (assignment.scenarioVersionId !== scenarioVersion.id || assignment.capsuleVersionId !== scenarioVersion.capsuleVersionId || instance.capsuleVersionId !== assignment.capsuleVersionId || scenarioVersion.document.spec?.capsuleVersion !== scenarioVersion.capsuleVersionId) throw fail('Assignment, instance, and Scenario must pin exact compatible versions', 'VERSION_PIN_MISMATCH');
  }
}

function createScenarioRunService(options = {}) {
  const guestCommandCheck = options.guestTransport ? new GuestCommandCheck({ transport: options.guestTransport, audit: options.audit, installedPlugins: options.installedPlugins }) : undefined;
  return new ScenarioRunService({ ...options, guestCommandCheck });
}

module.exports = { ScenarioRunService, createScenarioRunService };
