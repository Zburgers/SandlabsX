'use strict';
const crypto = require('node:crypto');
const clone = value => value === undefined ? undefined : structuredClone(value);
class InstanceRepository {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async transaction(work) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async create({ ownerId, capsuleVersionId, name }, client = this.pool) { const result = await client.query('INSERT INTO sandlabx_lab_instances (id,owner_user_id,capsule_version_id,name,state,desired_state) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [crypto.randomUUID(), ownerId, capsuleVersionId, name, 'STOPPED', 'STOPPED']); return row(result.rows[0]); }
  async get(id, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_lab_instances WHERE id=$1', [id]); return result.rows[0] && row(result.rows[0]); }
  async setDesiredState(id, desiredState, client = this.pool) { const result = await client.query('UPDATE sandlabx_lab_instances SET desired_state=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *', [id, desiredState]); if (!result.rows[0]) throw Object.assign(new Error('Instance not found'), { code: 'NOT_FOUND' }); return row(result.rows[0]); }
  async saveExecutionPlan(instanceId, capsuleVersionId, plan, client = this.pool) { const result = await client.query('INSERT INTO sandlabx_execution_plans (id,instance_id,capsule_version_id,semantic_hash,full_hash,document) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [crypto.randomUUID(), instanceId, capsuleVersionId, plan.semanticHash, plan.fullHash, plan]); return planRow(result.rows[0]); }
  async getExecutionPlan(instanceId, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_execution_plans WHERE instance_id=$1', [instanceId]); return result.rows[0] && planRow(result.rows[0]); }
}
class MemoryInstanceRepository {
  constructor() { this.items = new Map(); this.plans = new Map(); }
  async transaction(work) { const snapshot = clone([...this.items]); try { return await work(this); } catch (error) { this.items = new Map(snapshot); throw error; } }
  async create(input) { const value = { id: crypto.randomUUID(), ...clone(input), state: 'STOPPED', desiredState: 'STOPPED', createdAt: new Date().toISOString() }; this.items.set(value.id, value); return clone(value); }
  async get(id) { return clone(this.items.get(id)); }
  async setDesiredState(id, desiredState) { const value = this.items.get(id); if (!value) throw Object.assign(new Error('Instance not found'), { code: 'NOT_FOUND' }); value.desiredState = desiredState; return clone(value); }
  async saveExecutionPlan(instanceId, capsuleVersionId, plan) { const value = { id: crypto.randomUUID(), instanceId, capsuleVersionId, semanticHash: plan.semanticHash, fullHash: plan.fullHash, document: clone(plan) }; this.plans.set(instanceId, value); return clone(value); }
  async getExecutionPlan(instanceId) { return clone(this.plans.get(instanceId)); }
}
function row(value) { return { id: value.id, ownerId: value.owner_user_id, capsuleVersionId: value.capsule_version_id, name: value.name, state: value.state, desiredState: value.desired_state, createdAt: value.created_at, updatedAt: value.updated_at }; }
function planRow(value) { return { id: value.id, instanceId: value.instance_id, capsuleVersionId: value.capsule_version_id, semanticHash: value.semantic_hash, fullHash: value.full_hash, document: value.document, createdAt: value.created_at }; }
module.exports = { InstanceRepository, MemoryInstanceRepository };
