'use strict';
const { validateCapsule } = require('../domain/capsule');
const immutable = value => Object.freeze(structuredClone(value));
const error = (message, code, issues) => Object.assign(new Error(message), { code, issues });
const actorId = actor => actor?.id || actor?.sub;
function requireAuthor(actor) { if (!actorId(actor)) throw error('Authentication is required', 'UNAUTHORIZED'); if (!['admin', 'instructor'].includes(actor.role)) throw error('Capsule authoring requires instructor access', 'FORBIDDEN'); }

class CapsuleService {
  constructor({ repository, planPreview, instanceService, operationService }) { if (!repository) throw new TypeError('repository is required'); this.repository = repository; this.planPreview = planPreview; this.instanceService = instanceService; this.operationService = operationService; }
  async createDraft(actor, document) { requireAuthor(actor); return immutable(await this.repository.createDraft(actorId(actor), document)); }
  async getDraft(actor, id) { const draft = await this.repository.getDraft(id); this.#assertDraftAccess(actor, draft); return immutable(draft); }
  async updateDraft(actor, id, revision, patch) { const draft = await this.repository.getDraft(id); this.#assertDraftAccess(actor, draft); return immutable(await this.repository.updateDraft(id, revision, patch)); }
  async validateDraft(actor, id, published = false) { const draft = await this.getDraft(actor, id); const issues = validateCapsule(draft.document, { published }); return Object.freeze({ valid: issues.length === 0, issues }); }
  async createPrivateRevision(actor, id) { return this.#freeze(actor, id, 'PRIVATE'); }
  async publish(actor, id) { return this.#freeze(actor, id, 'PUBLISHED'); }
  async #freeze(actor, id, visibility) {
    requireAuthor(actor);
    return this.repository.transaction(async client => {
      const draft = await this.repository.getDraft(id, client); this.#assertDraftAccess(actor, draft);
      const issues = validateCapsule(draft.document, { published: visibility === 'PUBLISHED' });
      if (issues.length) throw error('Capsule validation failed', 'INVALID_CAPSULE', issues);
      return immutable({ ...await this.repository.createVersion({ capsuleId: draft.id, authorId: actorId(actor), visibility, document: draft.document }, client), visibility });
    });
  }
  async getVersion(actor, id) { const version = await this.repository.getVersion(id); if (!version) throw error('Capsule version not found', 'NOT_FOUND'); const draft = await this.repository.getDraft(version.capsuleId); this.#assertDraftAccess(actor, draft); return immutable(version); }
  async listVersions(actor, capsuleId) { await this.getDraft(actor, capsuleId); return Object.freeze((await this.repository.listVersions(capsuleId)).map(immutable)); }
  async requestPlanPreview(actor, capsuleVersionId, input = {}) { const version = await this.getVersion(actor, capsuleVersionId); if (!this.planPreview) throw error('Plan preview is unavailable', 'PLAN_PREVIEW_UNAVAILABLE'); return immutable(await this.planPreview({ version, actor, ...input })); }
  async createInstance(actor, input) { if (!this.instanceService) throw error('Instance service is unavailable', 'INSTANCE_SERVICE_UNAVAILABLE'); return this.instanceService.create(actor, input); }
  async submitLifecycleOperation(actor, input) { if (!this.operationService) throw error('Operation service is unavailable', 'OPERATION_SERVICE_UNAVAILABLE'); return this.operationService.submit(actor, input); }
  #assertDraftAccess(actor, draft) { if (!draft) throw error('Capsule draft not found', 'NOT_FOUND'); if (actor?.role !== 'admin' && draft.ownerId !== actorId(actor)) throw error('Capsule access denied', 'FORBIDDEN'); }
}
module.exports = { CapsuleService };
