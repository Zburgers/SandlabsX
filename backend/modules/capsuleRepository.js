const crypto = require('node:crypto');
const { capsuleHash, normalizeCapsule } = require('./capsuleSchema');

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
  const result = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch)) result[key] = value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(result[key], value) : clone(value);
  return result;
}

class CapsuleRepository {
  constructor(options = {}) {
    this.pool = options.pool;
  }

  async createDraft(ownerId, document) {
    const normalized = normalizeCapsule(document);
    const id = crypto.randomUUID();
    if (!this.pool) throw new Error('PostgreSQL pool is required');
    const result = await this.pool.query(`
      INSERT INTO sandlabx_capsules (id, owner_user_id, name, display_name, draft_document, revision, status)
      VALUES ($1, $2, $3, $4, $5, 1, 'DRAFT') RETURNING *
    `, [id, ownerId, normalized.metadata.name, normalized.metadata.displayName, normalized]);
    return rowToCapsule(result.rows[0]);
  }

  async updateDraft(id, ownerId, expectedRevision, patch) {
    if (!this.pool) throw new Error('PostgreSQL pool is required');
    const current = await this.pool.query('SELECT * FROM sandlabx_capsules WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [id, ownerId]);
    if (!current.rows.length) throw Object.assign(new Error('Capsule not found'), { code: 'NOT_FOUND' });
    if (current.rows[0].revision !== expectedRevision) throw Object.assign(new Error('Capsule revision conflict'), { code: 'REVISION_CONFLICT' });
    const document = normalizeCapsule(deepMerge(current.rows[0].draft_document, patch));
    const result = await this.pool.query(`
      UPDATE sandlabx_capsules SET name = $3, display_name = $4, draft_document = $5, revision = revision + 1,
        status = CASE WHEN status = 'PUBLISHED' THEN 'DRAFT' ELSE status END, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND owner_user_id = $2 AND revision = $6 RETURNING *
    `, [id, ownerId, document.metadata.name, document.metadata.displayName, document, expectedRevision]);
    if (!result.rows.length) throw Object.assign(new Error('Capsule revision conflict'), { code: 'REVISION_CONFLICT' });
    return rowToCapsule(result.rows[0]);
  }

  async get(id, ownerId) {
    if (!this.pool) throw new Error('PostgreSQL pool is required');
    const result = await this.pool.query('SELECT * FROM sandlabx_capsules WHERE id = $1 AND owner_user_id = $2', [id, ownerId]);
    if (!result.rows.length) return null;
    return rowToCapsule(result.rows[0]);
  }

  async list(ownerId) {
    if (!this.pool) throw new Error('PostgreSQL pool is required');
    const result = await this.pool.query('SELECT * FROM sandlabx_capsules WHERE owner_user_id = $1 ORDER BY updated_at DESC', [ownerId]);
    return result.rows.map(rowToCapsule);
  }

  async publish(id, ownerId, publishedBy = ownerId) {
    if (!this.pool) throw new Error('PostgreSQL pool is required');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT * FROM sandlabx_capsules WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [id, ownerId]);
      if (!current.rows.length) throw Object.assign(new Error('Capsule not found'), { code: 'NOT_FOUND' });
      const document = normalizeCapsule(current.rows[0].draft_document, { requireDigests: true });
      const versionResult = await client.query(`
        INSERT INTO sandlabx_capsule_versions (id, capsule_id, version_number, schema_version, normalized_document, content_sha256, published_by)
        VALUES ($1, $2, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM sandlabx_capsule_versions WHERE capsule_id = $2), $3, $4, $5, $6)
        RETURNING *
      `, [crypto.randomUUID(), id, document.apiVersion, document, capsuleHash(document), publishedBy]);
      await client.query("UPDATE sandlabx_capsules SET status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
      await client.query('COMMIT');
      return rowToVersion(versionResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async getVersion(id, ownerId) {
    if (!this.pool) throw new Error('PostgreSQL pool is required');
    const result = await this.pool.query(`
      SELECT version.* FROM sandlabx_capsule_versions version
      JOIN sandlabx_capsules capsule ON capsule.id = version.capsule_id
      WHERE version.id = $1 AND capsule.owner_user_id = $2
    `, [id, ownerId]);
    return result.rows.length ? rowToVersion(result.rows[0]) : null;
  }

  async listVersions(capsuleId, ownerId) {
    if (!this.pool) throw new Error('PostgreSQL pool is required');
    const result = await this.pool.query(`SELECT version.* FROM sandlabx_capsule_versions version JOIN sandlabx_capsules capsule ON capsule.id = version.capsule_id WHERE version.capsule_id = $1 AND capsule.owner_user_id = $2 ORDER BY version.version_number DESC`, [capsuleId, ownerId]);
    return result.rows.map(rowToVersion);
  }
}

class MemoryCapsuleRepository {
  constructor() { this.capsules = new Map(); this.versions = new Map(); }

  async createDraft(ownerId, document) {
    const normalized = normalizeCapsule(document);
    const item = { id: crypto.randomUUID(), ownerId, revision: 1, status: 'DRAFT', document: normalized, createdAt: new Date().toISOString() };
    this.capsules.set(item.id, item);
    return clone({ id: item.id, ownerId, revision: item.revision, status: item.status, document: item.document });
  }

  async updateDraft(id, ownerId, expectedRevision, patch) {
    const item = this.capsules.get(id);
    if (!item || item.ownerId !== ownerId) throw Object.assign(new Error('Capsule not found'), { code: 'NOT_FOUND' });
    if (item.revision !== expectedRevision) throw Object.assign(new Error('Capsule revision conflict'), { code: 'REVISION_CONFLICT' });
    item.document = normalizeCapsule(deepMerge(item.document, patch));
    item.revision += 1;
    if (item.status === 'PUBLISHED') item.status = 'DRAFT';
    return clone({ id, ownerId, revision: item.revision, status: item.status, document: item.document });
  }

  async get(id, ownerId) {
    const item = this.capsules.get(id);
    return item && item.ownerId === ownerId ? clone({ id, ownerId, revision: item.revision, status: item.status, document: item.document }) : null;
  }

  async list(ownerId) {
    return [...this.capsules.values()].filter(item => item.ownerId === ownerId).map(item => clone({ id: item.id, ownerId, revision: item.revision, status: item.status, document: item.document }));
  }

  async publish(id, ownerId) {
    const item = this.capsules.get(id);
    if (!item || item.ownerId !== ownerId) throw Object.assign(new Error('Capsule not found'), { code: 'NOT_FOUND' });
    const document = normalizeCapsule(item.document, { requireDigests: true });
    const version = { id: crypto.randomUUID(), capsuleId: id, versionNumber: [...this.versions.values()].filter(v => v.capsuleId === id).length + 1, document, contentSha256: capsuleHash(document), publishedBy: ownerId };
    this.versions.set(version.id, version);
    item.status = 'PUBLISHED';
    return clone(version);
  }

  async getVersion(id, ownerId) {
    const version = this.versions.get(id);
    const capsule = version && this.capsules.get(version.capsuleId);
    return capsule && capsule.ownerId === ownerId ? clone(version) : null;
  }

  async listVersions(capsuleId, ownerId) {
    return [...this.versions.values()].filter(version => version.capsuleId === capsuleId).map(version => clone(version)).filter(version => this.capsules.get(capsuleId)?.ownerId === ownerId);
  }
}

function rowToCapsule(row) {
  return { id: row.id, ownerId: row.owner_user_id, revision: row.revision, status: row.status, document: row.draft_document, createdAt: row.created_at, updatedAt: row.updated_at };
}
function rowToVersion(row) {
  return { id: row.id, capsuleId: row.capsule_id, versionNumber: row.version_number, schemaVersion: row.schema_version, document: row.normalized_document, contentSha256: row.content_sha256, publishedBy: row.published_by, publishedAt: row.published_at };
}

module.exports = { CapsuleRepository, MemoryCapsuleRepository, deepMerge, rowToCapsule, rowToVersion };
