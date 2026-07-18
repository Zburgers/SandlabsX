'use strict';

const crypto = require('node:crypto');

function clone(value) { return structuredClone(value); }

class MemoryImageArtifactRepository {
  constructor() { this.versions = new Map(); this.byDigest = new Map(); }

  async createVersion(input) {
    if (this.byDigest.has(input.digest)) throw codeError('Image digest already has an immutable version', 'DUPLICATE_DIGEST');
    const versionNumber = [...this.versions.values()].filter(version => version.name === input.name).length + 1;
    const version = { ...clone(input), id: input.id || crypto.randomUUID(), versionNumber, createdAt: new Date().toISOString() };
    this.versions.set(version.id, version);
    this.byDigest.set(version.digest, version.id);
    return clone(version);
  }

  async getVersion(id) { const version = this.versions.get(id); return version ? clone(version) : null; }
  async listVersions() { return [...this.versions.values()].map(clone); }
}

class ImageArtifactRepository {
  constructor({ pool }) { this.pool = pool; }

  async createVersion(input, client = this.pool) {
    const id = input.id || crypto.randomUUID();
    try {
      const result = await client.query(
        `WITH name_lock AS MATERIALIZED (
           SELECT pg_advisory_xact_lock(hashtextextended($2::text, 0))
         )
         INSERT INTO sandlabx_image_artifact_versions
          (id, artifact_name, version_number, digest, format, storage_path, size_bytes, virtual_size_bytes, architecture, provenance, metadata)
         SELECT $1, $2::varchar, COALESCE(MAX(version_number), 0) + 1, $3, $4, $5, $6, $7, $8, $9, $10
         FROM name_lock
         LEFT JOIN sandlabx_image_artifact_versions ON artifact_name = $2::varchar
         RETURNING *`,
        [id, input.name, input.digest, input.format, input.storagePath, input.sizeBytes, input.virtualSizeBytes || null, input.architecture || null, input.provenance, input.metadata || {}],
      );
      return rowToImageVersion(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') throw codeError('Image digest already has an immutable version', 'DUPLICATE_DIGEST');
      throw error;
    }
  }

  async getVersion(id, client = this.pool) {
    const result = await client.query('SELECT * FROM sandlabx_image_artifact_versions WHERE id = $1', [id]);
    return result.rows[0] ? rowToImageVersion(result.rows[0]) : null;
  }

  async listVersions(client = this.pool) {
    const result = await client.query('SELECT * FROM sandlabx_image_artifact_versions ORDER BY created_at DESC');
    return result.rows.map(rowToImageVersion);
  }
}

function rowToImageVersion(row) {
  return {
    id: row.id, name: row.artifact_name, versionNumber: row.version_number, digest: row.digest,
    format: row.format, storagePath: row.storage_path, sizeBytes: Number(row.size_bytes),
    virtualSizeBytes: row.virtual_size_bytes === null ? null : Number(row.virtual_size_bytes),
    architecture: row.architecture, provenance: row.provenance, metadata: row.metadata || {}, createdAt: row.created_at,
  };
}

function codeError(message, code) { return Object.assign(new Error(message), { code }); }

module.exports = { ImageArtifactRepository, MemoryImageArtifactRepository, rowToImageVersion };
