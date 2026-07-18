'use strict';
const crypto = require('node:crypto');
const clone = value => value === undefined ? undefined : structuredClone(value);
class OperationRepository {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async create(input, client = this.pool) { try { const result = await client.query('INSERT INTO sandlabx_operations (id,owner_user_id,type,resource_type,resource_id,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [crypto.randomUUID(), input.ownerId, input.type, input.resourceType, input.resourceId || null, input.idempotencyKey]); return opRow(result.rows[0]); } catch (error) { if (error.code !== '23505' || !input.idempotencyKey) throw error; const result = await client.query('SELECT * FROM sandlabx_operations WHERE owner_user_id=$1 AND idempotency_key=$2', [input.ownerId, input.idempotencyKey]); return opRow(result.rows[0]); } }
  async get(id, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_operations WHERE id=$1', [id]); return result.rows[0] && opRow(result.rows[0]); }
  async requestCancel(id, client = this.pool) { const result = await client.query("UPDATE sandlabx_operations SET state=CASE WHEN state IN ('QUEUED','PLANNING','RESERVED','EXECUTING') THEN 'CANCELLING' ELSE state END,cancel_requested_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [id]); return result.rows[0] && opRow(result.rows[0]); }
  async appendEvent({ operationId, instanceId, type, payload = {} }, client = this.pool) { const result = await client.query('INSERT INTO sandlabx_instance_events (operation_id,instance_id,sequence,event_type,payload) VALUES ($1,$2,(SELECT COALESCE(MAX(sequence),0)+1 FROM sandlabx_instance_events WHERE operation_id=$1),$3,$4) RETURNING *', [operationId, instanceId || null, type, payload]); return eventRow(result.rows[0]); }
  async listEvents(after = 0, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_instance_events WHERE id>$1 ORDER BY id ASC', [after]); return result.rows.map(eventRow); }
}
class MemoryOperationRepository {
  constructor() { this.operations = new Map(); this.events = []; this.cursor = 0; }
  async create(input) { const duplicate = input.idempotencyKey && [...this.operations.values()].find(value => value.ownerId === input.ownerId && value.idempotencyKey === input.idempotencyKey); if (duplicate) return clone(duplicate); const value = { id: crypto.randomUUID(), ...clone(input), state: 'QUEUED', createdAt: new Date().toISOString() }; this.operations.set(value.id, value); return clone(value); }
  async get(id) { return clone(this.operations.get(id)); }
  async requestCancel(id) { const value = this.operations.get(id); if (!value) return null; if (['QUEUED', 'PLANNING', 'RESERVED', 'EXECUTING'].includes(value.state)) value.state = 'CANCELLING'; return clone(value); }
  async appendEvent(input) { const value = { cursor: ++this.cursor, operationId: input.operationId, instanceId: input.instanceId || null, type: input.type, payload: clone(input.payload || {}) }; this.events.push(value); return clone(value); }
  async listEvents(after = 0) { return this.events.filter(event => event.cursor > after).map(clone); }
}
function opRow(value) { return { id: value.id, ownerId: value.owner_user_id, type: value.type, resourceType: value.resource_type, resourceId: value.resource_id, idempotencyKey: value.idempotency_key, state: value.state, progress: value.progress, createdAt: value.created_at, updatedAt: value.updated_at }; }
function eventRow(value) { return { cursor: Number(value.id), operationId: value.operation_id, instanceId: value.instance_id, type: value.event_type, payload: value.payload, occurredAt: value.occurred_at }; }
module.exports = { OperationRepository, MemoryOperationRepository };
