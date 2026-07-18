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
    if (client === this.pool) return this.transaction(tx => this.createDraft(ownerId, document, tx));
    const id = crypto.randomUUID(); const normalized = normalizeCapsule(document);
    await client.query('INSERT INTO sandlabx_capsules (id, owner_user_id, name, display_name, draft_document) VALUES ($1,$2,$3,$4,$5)', [id, ownerId, normalized.metadata.name, normalized.metadata.displayName || normalized.metadata.name, {}]);
    const result = await client.query('INSERT INTO sandlabx_capsule_drafts (id,capsule_id,owner_user_id,document,revision) VALUES ($1,$2,$3,$4,1) RETURNING *', [crypto.randomUUID(), id, ownerId, normalized]);
    return draftRow({ ...result.rows[0], capsule_id: id });
  }
  async getDraft(id, client = this.pool) {
    const result = await client.query(`SELECT c.id AS capsule_id, d.id AS draft_id, d.owner_user_id, d.document, d.revision, c.status, d.created_at, d.updated_at
      FROM sandlabx_capsules c JOIN LATERAL (SELECT * FROM sandlabx_capsule_drafts WHERE capsule_id=c.id ORDER BY revision DESC LIMIT 1) d ON true WHERE c.id=$1`, [id]);
    return result.rows[0] && draftRow(result.rows[0]);
  }
  async listDrafts(ownerId, { all = false } = {}, client = this.pool) { const result = await client.query(`SELECT c.id AS capsule_id,d.id AS draft_id,d.owner_user_id,d.document,d.revision,c.status,d.created_at,d.updated_at FROM sandlabx_capsules c JOIN LATERAL (SELECT * FROM sandlabx_capsule_drafts WHERE capsule_id=c.id ORDER BY revision DESC LIMIT 1) d ON true WHERE ($2::boolean OR d.owner_user_id=$1) ORDER BY d.updated_at DESC,c.id`, [ownerId, all]); return result.rows.map(draftRow); }
  async updateDraft(id, expectedRevision, patch, client = this.pool) {
    if (client === this.pool) return this.transaction(tx => this.updateDraft(id, expectedRevision, patch, tx));
    const parent = await client.query('SELECT id FROM sandlabx_capsules WHERE id=$1 FOR UPDATE', [id]); if (!parent.rows[0]) throw codeError('Capsule draft not found', 'NOT_FOUND');
    const current = await this.getDraft(id, client); if (current.revision !== expectedRevision) throw codeError('Capsule revision conflict', 'REVISION_CONFLICT');
    const document = normalizeCapsule(deepMerge(current.document, patch));
    const nextRevision = current.revision + 1;
    const result = await client.query('INSERT INTO sandlabx_capsule_drafts (id,capsule_id,owner_user_id,document,revision) VALUES ($1,$2,$3,$4,$5) RETURNING *', [crypto.randomUUID(), id, current.ownerId, document, nextRevision]);
    await client.query('UPDATE sandlabx_capsules SET name=$2, display_name=$3, revision=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id, document.metadata.name, document.metadata.displayName || document.metadata.name, nextRevision]);
    return draftRow({ ...result.rows[0], capsule_id: id, status: current.status });
  }
  async createVersion({ capsuleId, authorId, visibility, document }, client = this.pool) {
    if (client === this.pool) return this.transaction(tx => this.createVersion({ capsuleId, authorId, visibility, document }, tx));
    const normalized = normalizeCapsule(document); const digest = hashCapsule(normalized);
    const privateRevision = visibility === 'PRIVATE';
    const table = privateRevision ? 'sandlabx_capsule_private_revisions' : 'sandlabx_capsule_versions';
    const numberColumn = privateRevision ? 'revision_number' : 'version_number';
    const authorColumn = privateRevision ? 'created_by' : 'published_by';
    const counterColumn = privateRevision ? 'private_revision_counter' : 'published_version_counter';
    const parent = await client.query('SELECT id FROM sandlabx_capsules WHERE id=$1 FOR UPDATE', [capsuleId]);
    if (!parent.rows[0]) throw codeError('Capsule not found', 'NOT_FOUND');
    const existing = await client.query(`SELECT * FROM ${table} WHERE capsule_id=$1 AND content_sha256=$2`, [capsuleId, digest]);
    if (existing.rows[0]) return versionRow(existing.rows[0], visibility);
    const counter = await client.query(`UPDATE sandlabx_capsules SET ${counterColumn}=${counterColumn}+1 WHERE id=$1 RETURNING ${counterColumn} AS value`, [capsuleId]);
    const result = await client.query(`INSERT INTO ${table} (id,capsule_id,${numberColumn},schema_version,normalized_document,content_sha256,${authorColumn}) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [crypto.randomUUID(), capsuleId, counter.rows[0].value, normalized.apiVersion, normalized, digest, authorId]);
    return versionRow(result.rows[0], visibility);
  }
  async getVersion(id, client = this.pool) { const result = await client.query(`SELECT *, 'PUBLISHED' AS visibility FROM sandlabx_capsule_versions WHERE id=$1 UNION ALL SELECT *, 'PRIVATE' AS visibility FROM sandlabx_capsule_private_revisions WHERE id=$1`, [id]); return result.rows[0] && versionRow(result.rows[0], result.rows[0].visibility); }
  async listVersions(capsuleId, client = this.pool) { const result = await client.query(`SELECT *, version_number AS ordinal, 'PUBLISHED' AS visibility FROM sandlabx_capsule_versions WHERE capsule_id=$1 UNION ALL SELECT *, revision_number AS ordinal, 'PRIVATE' AS visibility FROM sandlabx_capsule_private_revisions WHERE capsule_id=$1 ORDER BY created_at DESC`, [capsuleId]); return result.rows.map(row => versionRow(row, row.visibility)); }
}

class MemoryCapsuleRepository {
  constructor() { this.drafts = new Map(); this.versions = new Map(); }
  async transaction(work) { const drafts = clone([...this.drafts]); const versions = clone([...this.versions]); try { return await work(this); } catch (error) { this.drafts = new Map(drafts); this.versions = new Map(versions); throw error; } }
  async createDraft(ownerId, document) { const item = { id: crypto.randomUUID(), ownerId, document: normalizeCapsule(document), revision: 1, status: 'DRAFT', createdAt: new Date().toISOString() }; this.drafts.set(item.id, item); return clone(item); }
  async getDraft(id) { return clone(this.drafts.get(id)); }
  async listDrafts(ownerId, { all = false } = {}) { return [...this.drafts.values()].filter(item => all || item.ownerId === ownerId).map(clone); }
  async updateDraft(id, expectedRevision, patch) { const item = this.drafts.get(id); if (!item) throw codeError('Capsule draft not found', 'NOT_FOUND'); if (item.revision !== expectedRevision) throw codeError('Capsule revision conflict', 'REVISION_CONFLICT'); item.document = normalizeCapsule(deepMerge(item.document, patch)); item.revision += 1; return clone(item); }
  async createVersion({ capsuleId, authorId, visibility, document }) { const digest = hashCapsule(document); const existing = [...this.versions.values()].find(v => v.capsuleId === capsuleId && v.contentSha256 === digest); if (existing) return clone(existing); const item = { id: crypto.randomUUID(), capsuleId, authorId, visibility, versionNumber: [...this.versions.values()].filter(v => v.capsuleId === capsuleId).length + 1, document: normalizeCapsule(document), contentSha256: digest, createdAt: new Date().toISOString() }; this.versions.set(item.id, item); return clone(item); }
  async getVersion(id) { return clone(this.versions.get(id)); }
  async listVersions(capsuleId) { return [...this.versions.values()].filter(v => v.capsuleId === capsuleId).map(clone); }
}
function draftRow(row) { return { id: row.capsule_id || row.id, draftId: row.draft_id || row.id, ownerId: row.owner_user_id, document: row.document, revision: row.revision, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function versionRow(row, visibility = 'PUBLISHED') { return { id: row.id, capsuleId: row.capsule_id, authorId: row.published_by || row.created_by, versionNumber: row.version_number || row.revision_number, document: row.normalized_document, contentSha256: row.content_sha256, visibility, createdAt: row.published_at || row.created_at }; }
module.exports = { CapsuleRepository, MemoryCapsuleRepository, deepMerge };
