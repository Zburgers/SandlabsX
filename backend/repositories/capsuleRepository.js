'use strict';

const crypto = require('node:crypto');
const { normalizeCapsule, hashCapsule } = require('../domain/capsule');

const clone = value => value === undefined ? undefined : structuredClone(value);
const codeError = (message, code) => Object.assign(new Error(message), { code });
const deepMerge = (base, patch) => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
  const result = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch)) result[key] = value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(result[key], value) : clone(value);
  return result;
};

class CapsuleRepository {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async transaction(work) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async createDraft(ownerId, document, client = this.pool) {
    const id = crypto.randomUUID(); const normalized = normalizeCapsule(document);
    const result = await client.query('INSERT INTO sandlabx_capsules (id, owner_user_id, name, display_name, draft_document) VALUES ($1,$2,$3,$4,$5) RETURNING *', [id, ownerId, normalized.metadata.name, normalized.metadata.displayName || normalized.metadata.name, normalized]);
    return draftRow(result.rows[0]);
  }
  async getDraft(id, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_capsules WHERE id = $1', [id]); return result.rows[0] && draftRow(result.rows[0]); }
  async updateDraft(id, expectedRevision, patch, client = this.pool) {
    const current = await this.getDraft(id, client); if (!current) throw codeError('Capsule draft not found', 'NOT_FOUND'); if (current.revision !== expectedRevision) throw codeError('Capsule revision conflict', 'REVISION_CONFLICT');
    const document = normalizeCapsule(deepMerge(current.document, patch));
    const result = await client.query('UPDATE sandlabx_capsules SET name=$2, display_name=$3, draft_document=$4, revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND revision=$5 RETURNING *', [id, document.metadata.name, document.metadata.displayName || document.metadata.name, document, expectedRevision]);
    if (!result.rows[0]) throw codeError('Capsule revision conflict', 'REVISION_CONFLICT'); return draftRow(result.rows[0]);
  }
  async createVersion({ capsuleId, authorId, visibility, document }, client = this.pool) {
    const normalized = normalizeCapsule(document); const digest = hashCapsule(normalized);
    const existing = await client.query('SELECT * FROM sandlabx_capsule_versions WHERE capsule_id=$1 AND content_sha256=$2', [capsuleId, digest]);
    if (existing.rows[0]) return versionRow(existing.rows[0]);
    const result = await client.query('INSERT INTO sandlabx_capsule_versions (id,capsule_id,version_number,schema_version,normalized_document,content_sha256,published_by) VALUES ($1,$2,(SELECT COALESCE(MAX(version_number),0)+1 FROM sandlabx_capsule_versions WHERE capsule_id=$2),$3,$4,$5,$6) RETURNING *', [crypto.randomUUID(), capsuleId, normalized.apiVersion, normalized, digest, authorId]);
    return { ...versionRow(result.rows[0]), visibility };
  }
  async getVersion(id, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_capsule_versions WHERE id=$1', [id]); return result.rows[0] && versionRow(result.rows[0]); }
  async listVersions(capsuleId, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_capsule_versions WHERE capsule_id=$1 ORDER BY version_number DESC', [capsuleId]); return result.rows.map(versionRow); }
}

class MemoryCapsuleRepository {
  constructor() { this.drafts = new Map(); this.versions = new Map(); }
  async transaction(work) { const drafts = clone([...this.drafts]); const versions = clone([...this.versions]); try { return await work(this); } catch (error) { this.drafts = new Map(drafts); this.versions = new Map(versions); throw error; } }
  async createDraft(ownerId, document) { const item = { id: crypto.randomUUID(), ownerId, document: normalizeCapsule(document), revision: 1, status: 'DRAFT', createdAt: new Date().toISOString() }; this.drafts.set(item.id, item); return clone(item); }
  async getDraft(id) { return clone(this.drafts.get(id)); }
  async updateDraft(id, expectedRevision, patch) { const item = this.drafts.get(id); if (!item) throw codeError('Capsule draft not found', 'NOT_FOUND'); if (item.revision !== expectedRevision) throw codeError('Capsule revision conflict', 'REVISION_CONFLICT'); item.document = normalizeCapsule(deepMerge(item.document, patch)); item.revision += 1; return clone(item); }
  async createVersion({ capsuleId, authorId, visibility, document }) { const digest = hashCapsule(document); const existing = [...this.versions.values()].find(v => v.capsuleId === capsuleId && v.contentSha256 === digest); if (existing) return clone(existing); const item = { id: crypto.randomUUID(), capsuleId, authorId, visibility, versionNumber: [...this.versions.values()].filter(v => v.capsuleId === capsuleId).length + 1, document: normalizeCapsule(document), contentSha256: digest, createdAt: new Date().toISOString() }; this.versions.set(item.id, item); return clone(item); }
  async getVersion(id) { return clone(this.versions.get(id)); }
  async listVersions(capsuleId) { return [...this.versions.values()].filter(v => v.capsuleId === capsuleId).map(clone); }
}
function draftRow(row) { return { id: row.id, ownerId: row.owner_user_id, document: row.draft_document, revision: row.revision, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function versionRow(row) { return { id: row.id, capsuleId: row.capsule_id, authorId: row.published_by, versionNumber: row.version_number, document: row.normalized_document, contentSha256: row.content_sha256, createdAt: row.published_at }; }
module.exports = { CapsuleRepository, MemoryCapsuleRepository, deepMerge };
