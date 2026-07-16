const crypto = require('node:crypto');

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
}

module.exports = { MemoryOperationRepository };
