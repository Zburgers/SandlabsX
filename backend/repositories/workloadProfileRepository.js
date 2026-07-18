'use strict';

const crypto = require('node:crypto');

function clone(value) { return structuredClone(value); }

class MemoryWorkloadProfileRepository {
  constructor() { this.versions = new Map(); this.byContentHash = new Map(); }

  async createVersion(input) {
    if (this.byContentHash.has(input.contentHash)) throw codeError('Workload profile content is already published', 'DUPLICATE_CONTENT');
    const version = { id: input.id || crypto.randomUUID(), versionNumber: 1, contentHash: input.contentHash, createdAt: new Date().toISOString(), ...clone(input.profile) };
    this.versions.set(version.id, version);
    this.byContentHash.set(version.contentHash, version.id);
    return clone(version);
  }

  async getVersion(id) { const version = this.versions.get(id); return version ? clone(version) : null; }
}

class WorkloadProfileRepository {
  constructor({ pool }) { this.pool = pool; }

  async createVersion(input, client = this.pool) {
    const id = input.id || crypto.randomUUID();
    try {
      const result = await client.query(
        `INSERT INTO sandlabx_workload_profile_versions
          (id, profile_name, version_number, content_sha256, profile)
         VALUES ($1, $2, 1, $3, $4) RETURNING *`,
        [id, input.name, input.contentHash, input.profile],
      );
      return rowToWorkloadProfileVersion(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') throw codeError('Workload profile content is already published', 'DUPLICATE_CONTENT');
      throw error;
    }
  }

  async getVersion(id, client = this.pool) {
    const result = await client.query('SELECT * FROM sandlabx_workload_profile_versions WHERE id = $1', [id]);
    return result.rows[0] ? rowToWorkloadProfileVersion(result.rows[0]) : null;
  }
}

function rowToWorkloadProfileVersion(row) {
  return { id: row.id, name: row.profile_name, versionNumber: row.version_number, contentHash: row.content_sha256, ...row.profile, createdAt: row.created_at };
}

function codeError(message, code) { return Object.assign(new Error(message), { code }); }

module.exports = { MemoryWorkloadProfileRepository, WorkloadProfileRepository, rowToWorkloadProfileVersion };
