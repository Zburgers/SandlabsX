'use strict';
const { validateScenario } = require('../domain/scenario');
const immutable = value => Object.freeze(structuredClone(value));
const error = (message, code, issues) => Object.assign(new Error(message), { code, issues });
const actorId = actor => actor?.id || actor?.sub;
function requireAuthor(actor) { if (!actorId(actor)) throw error('Authentication is required', 'UNAUTHORIZED'); if (!['admin', 'instructor'].includes(actor.role)) throw error('Scenario authoring requires instructor access', 'FORBIDDEN'); }
class ScenarioService {
  constructor({ repository, capsuleVersions }) { if (!repository || !capsuleVersions) throw new TypeError('repository and capsuleVersions are required'); this.repository = repository; this.capsuleVersions = capsuleVersions; }
  async createDraft(actor, document) { requireAuthor(actor); return immutable(await this.repository.createDraft(actorId(actor), document)); }
  async getDraft(actor, id) { const draft = await this.repository.getDraft(id); this.#assertAccess(actor, draft); return immutable(draft); }
  async publish(actor, id) {
    requireAuthor(actor);
    return this.repository.transaction(async client => {
      const draft = await this.repository.getDraft(id, client); this.#assertAccess(actor, draft);
      const requested = draft.document.spec?.capsuleVersion;
      if (!requested || requested === 'latest') throw error('Scenario requires an exact Capsule version', 'INVALID_SCENARIO');
      const capsule = await this.capsuleVersions.get(requested, client);
      if (!capsule) throw error('Referenced Capsule version was not found', 'CAPSULE_VERSION_NOT_FOUND');
      const nodes = Object.fromEntries(Object.entries(capsule.document.nodes || {}).map(([name, node]) => [name, (node.interfaces || []).map(item => item.id)]));
      const issues = validateScenario(draft.document, { capsuleVersion: capsule.id, nodes, checkpoints: capsule.document.checkpoints || [], artifacts: capsule.document.artifacts || [] });
      if (issues.length) throw error('Scenario validation failed', 'INVALID_SCENARIO', issues);
      return immutable({ ...await this.repository.createVersion({ draft, document: draft.document }, client), visibility: 'PUBLISHED' });
    });
  }
  async getVersion(actor, id) { const version = await this.repository.getVersion(id); if (!version) throw error('Scenario version not found', 'NOT_FOUND'); return immutable(version); }
  #assertAccess(actor, draft) { if (!draft) throw error('Scenario draft not found', 'NOT_FOUND'); if (actor?.role !== 'admin' && draft.ownerId !== actorId(actor)) throw error('Scenario access denied', 'FORBIDDEN'); }
}
module.exports = { ScenarioService };
