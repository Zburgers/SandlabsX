const crypto = require('node:crypto');

class OperationRepository {
  constructor({ pool }) { this.pool = pool; }

  async create(input) {
    const id = crypto.randomUUID();
    try {
      const result = await this.pool.query(`INSERT INTO sandlabx_operations (id, owner_user_id, type, resource_type, resource_id, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [id, input.ownerId, input.type, input.resourceType || 'instance', input.resourceId || null, input.idempotencyKey || null]);
      return rowToOperation(result.rows[0]);
    } catch (error) {
      if (error.code !== '23505' || !input.idempotencyKey) throw error;
      const existing = await this.pool.query('SELECT * FROM sandlabx_operations WHERE owner_user_id = $1 AND idempotency_key = $2', [input.ownerId, input.idempotencyKey]);
      return rowToOperation(existing.rows[0]);
    }
  }

  async get(id, ownerId) {
    const result = await this.pool.query('SELECT * FROM sandlabx_operations WHERE id = $1 AND owner_user_id = $2', [id, ownerId]);
    return result.rows.length ? rowToOperation(result.rows[0]) : null;
  }

  async update(id, patch) {
    const columns = { state: 'state', progress: 'progress', result: 'result', error: 'error', cancelRequestedAt: 'cancel_requested_at' };
    const entries = Object.entries(patch).filter(([key]) => columns[key]);
    if (!entries.length) return this.getById(id);
    const values = entries.map(([, value]) => value);
    const setters = entries.map(([key], index) => `${columns[key]} = $${index + 2}`);
    const result = await this.pool.query(`UPDATE sandlabx_operations SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id, ...values]);
    return rowToOperation(result.rows[0]);
  }

  async getById(id) {
    const result = await this.pool.query('SELECT * FROM sandlabx_operations WHERE id = $1', [id]);
    return result.rows.length ? rowToOperation(result.rows[0]) : null;
  }

  async appendEvent(operationId, event) {
    const result = await this.pool.query(`INSERT INTO sandlabx_instance_events (operation_id, sequence, event_type, payload) VALUES ($1, (SELECT COALESCE(MAX(sequence), 0) + 1 FROM sandlabx_instance_events WHERE operation_id = $1), $2, $3) RETURNING *`, [operationId, event.type, event]);
    return { id: result.rows[0].id, operationId, sequence: result.rows[0].sequence, type: result.rows[0].event_type, ...result.rows[0].payload, occurredAt: result.rows[0].occurred_at };
  }

  async listEvents(operationId) {
    const result = await this.pool.query('SELECT * FROM sandlabx_instance_events WHERE operation_id = $1 ORDER BY sequence', [operationId]);
    return result.rows.map(row => ({ id: row.id, operationId, sequence: row.sequence, type: row.event_type, ...row.payload, occurredAt: row.occurred_at }));
  }

  async requestCancel(id, ownerId) {
    const result = await this.pool.query(`UPDATE sandlabx_operations SET state = CASE WHEN state IN ('QUEUED', 'PLANNING', 'RESERVED', 'EXECUTING') THEN 'CANCELLING' ELSE state END, cancel_requested_at = CURRENT_TIMESTAMP WHERE id = $1 AND owner_user_id = $2 RETURNING *`, [id, ownerId]);
    return result.rows.length ? rowToOperation(result.rows[0]) : null;
  }

  async leaseNext(workerId, leaseMs = 30000) {
    const result = await this.pool.query(`
      UPDATE sandlabx_operations SET state = 'EXECUTING', lease_owner = $1, lease_until = CURRENT_TIMESTAMP + ($2 * INTERVAL '1 millisecond'), updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM sandlabx_operations WHERE state IN ('QUEUED', 'PLANNING', 'RESERVED') AND (lease_until IS NULL OR lease_until < CURRENT_TIMESTAMP) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *
    `, [workerId, leaseMs]);
    return result.rows.length ? rowToOperation(result.rows[0]) : null;
  }
}

class MemoryOperationRepository {
  constructor() { this.operations = new Map(); this.events = new Map(); }

  async create(input) {
    if (input.idempotencyKey) {
      const existing = [...this.operations.values()].find(operation => operation.ownerId === input.ownerId && operation.idempotencyKey === input.idempotencyKey);
      if (existing) return structuredClone(existing);
    }
    const operation = { id: crypto.randomUUID(), ownerId: input.ownerId, type: input.type, resourceId: input.resourceId || null, idempotencyKey: input.idempotencyKey || null, state: 'QUEUED', progress: 0, error: null, createdAt: new Date().toISOString() };
    this.operations.set(operation.id, operation);
    this.events.set(operation.id, []);
    return structuredClone(operation);
  }

  async get(id, ownerId) {
    const operation = this.operations.get(id);
    return operation && operation.ownerId === ownerId ? structuredClone(operation) : null;
  }

  async update(id, patch) {
    const operation = this.operations.get(id);
    if (!operation) throw Object.assign(new Error('Operation not found'), { code: 'NOT_FOUND' });
    Object.assign(operation, patch);
    return structuredClone(operation);
  }

  async appendEvent(id, event) {
    const list = this.events.get(id);
    if (!list) throw Object.assign(new Error('Operation not found'), { code: 'NOT_FOUND' });
    const item = { id: crypto.randomUUID(), operationId: id, sequence: list.length + 1, occurredAt: new Date().toISOString(), ...event };
    list.push(item);
    return structuredClone(item);
  }

  async listEvents(id) { return structuredClone(this.events.get(id) || []); }

  async leaseNext(workerId, leaseMs = 30000) {
    const operation = [...this.operations.values()].find(item => ['QUEUED', 'PLANNING', 'RESERVED'].includes(item.state) && (!item.leaseUntil || item.leaseUntil < Date.now()));
    if (!operation) return null;
    operation.state = 'EXECUTING'; operation.leaseOwner = workerId; operation.leaseUntil = Date.now() + leaseMs;
    return structuredClone(operation);
  }
}

function rowToOperation(row) {
  return { id: row.id, ownerId: row.owner_user_id, type: row.type, resourceType: row.resource_type, resourceId: row.resource_id, idempotencyKey: row.idempotency_key, state: row.state, progress: row.progress, result: row.result, error: row.error, createdAt: row.created_at, updatedAt: row.updated_at };
}

module.exports = { MemoryOperationRepository, OperationRepository, rowToOperation };
