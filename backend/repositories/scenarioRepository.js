'use strict';
const crypto = require('node:crypto');
const { normalizeScenario } = require('../domain/scenario');
const { createHash } = require('node:crypto');
const clone = value => value === undefined ? undefined : structuredClone(value);
const codeError = (message, code) => Object.assign(new Error(message), { code });
const hash = document => `sha256:${createHash('sha256').update(JSON.stringify(normalizeScenario(document))).digest('hex')}`;
class ScenarioRepository {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async transaction(work) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async createDraft(ownerId, document, client = this.pool) { const normalized = normalizeScenario(document); const scenarioId = crypto.randomUUID(); const draftId = crypto.randomUUID(); await client.query('INSERT INTO sandlabx_scenarios (id,owner_user_id,name) VALUES ($1,$2,$3)', [scenarioId, ownerId, normalized.metadata.name]); const result = await client.query('INSERT INTO sandlabx_scenario_drafts (id,scenario_id,owner_user_id,document,revision) VALUES ($1,$2,$3,$4,1) RETURNING *', [draftId, scenarioId, ownerId, normalized]); return scenarioDraftRow(result.rows[0]); }
  async getDraft(id, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_scenario_drafts WHERE id=$1', [id]); return result.rows[0] && scenarioDraftRow(result.rows[0]); }
  async createVersion({ draft, document }, client = this.pool) { const digest = hash(document); const existing = await client.query('SELECT * FROM sandlabx_scenario_versions WHERE scenario_id=$1 AND content_sha256=$2', [draft.scenarioId, digest]); if (existing.rows[0]) return scenarioVersionRow(existing.rows[0]); const result = await client.query('INSERT INTO sandlabx_scenario_versions (id,scenario_id,version_number,capsule_version_id,document,content_sha256) VALUES ($1,$2,(SELECT COALESCE(MAX(version_number),0)+1 FROM sandlabx_scenario_versions WHERE scenario_id=$2),$3,$4,$5) RETURNING *', [crypto.randomUUID(), draft.scenarioId, document.spec.capsuleVersion, normalizeScenario(document), digest]); return scenarioVersionRow(result.rows[0]); }
  async getVersion(id, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_scenario_versions WHERE id=$1', [id]); return result.rows[0] && scenarioVersionRow(result.rows[0]); }
  async listVersions(scenarioId, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_scenario_versions WHERE scenario_id=$1', [scenarioId]); return result.rows.map(scenarioVersionRow); }
}
class MemoryScenarioRepository {
  constructor({ failPublication = false } = {}) { this.failPublication = failPublication; this.drafts = new Map(); this.versions = new Map(); }
  async transaction(work) { const drafts = clone([...this.drafts]); const versions = clone([...this.versions]); try { return await work(this); } catch (error) { this.drafts = new Map(drafts); this.versions = new Map(versions); throw error; } }
  async createDraft(ownerId, document) { const item = { id: crypto.randomUUID(), scenarioId: crypto.randomUUID(), ownerId, document: normalizeScenario(document), revision: 1 }; this.drafts.set(item.id, item); return clone(item); }
  async getDraft(id) { return clone(this.drafts.get(id)); }
  async createVersion({ draft, document }) { if (this.failPublication) throw codeError('Scenario publication failed', 'PUBLICATION_FAILED'); const digest = hash(document); const existing = [...this.versions.values()].find(v => v.scenarioId === draft.scenarioId && v.contentSha256 === digest); if (existing) return clone(existing); const item = { id: crypto.randomUUID(), scenarioId: draft.scenarioId, capsuleVersionId: document.spec.capsuleVersion, document: normalizeScenario(document), contentSha256: digest, versionNumber: [...this.versions.values()].filter(v => v.scenarioId === draft.scenarioId).length + 1 }; this.versions.set(item.id, item); return clone(item); }
  async getVersion(id) { return clone(this.versions.get(id)); }
  async listVersions(scenarioId) { return [...this.versions.values()].filter(v => v.scenarioId === scenarioId).map(clone); }
}
function scenarioDraftRow(row) { return { id: row.id, scenarioId: row.scenario_id, ownerId: row.owner_user_id, document: row.document, revision: row.revision }; }
function scenarioVersionRow(row) { return { id: row.id, scenarioId: row.scenario_id, capsuleVersionId: row.capsule_version_id, document: row.document, contentSha256: row.content_sha256, versionNumber: row.version_number }; }
module.exports = { ScenarioRepository, MemoryScenarioRepository };
