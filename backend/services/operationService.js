'use strict';
const crypto = require('node:crypto');
const clone = value => structuredClone(value);
class OperationService {
  constructor({ store, maxAttempts = 3 }) { if (!store) throw new TypeError('store is required'); this.store = store; this.maxAttempts = maxAttempts; }
  async submit(input) { if (!input.ownerId || !input.type || !input.instanceId || !input.idempotencyKey) throw new TypeError('ownerId, type, instanceId, and idempotencyKey are required'); return this.store.create(input); }
  async get(id) { return this.store.get(id); }
  async requestCancel(id, ownerId) { return this.store.requestCancel(id, ownerId); }
  async leaseNext(runnerId, leaseMs = 30_000) { return this.store.leaseNext(runnerId, leaseMs); }
  async finish(id, state, error = null) { return this.store.finish(id, state, error); }
  async execute(id, handlers) { const operation = await this.store.get(id); if (!operation) throw Object.assign(new Error('Operation not found'), { code: 'NOT_FOUND' }); const completed = [];
    try { for (const handler of handlers) { const step = await this.store.upsertStep(id, handler.key); if (step.state === 'SUCCEEDED') { completed.push(handler); continue; } await this.store.markStep(id, handler.key, 'RUNNING'); try { await retry(() => handler.run(), this.maxAttempts); await this.store.markStep(id, handler.key, 'SUCCEEDED'); completed.push(handler); } catch (error) { await this.store.markStep(id, handler.key, 'FAILED', { code: error.code || 'OPERATION_FAILED', message: error.message }); throw error; } const latest = await this.store.get(id); if (latest.cancelRequested) { for (const done of completed.reverse()) if (done.compensate) await done.compensate(); await this.store.finish(id, 'CANCELLED'); return this.store.get(id); } }
      await this.store.finish(id, 'SUCCEEDED'); return this.store.get(id);
    } catch (error) { for (const done of completed.reverse()) if (done.compensate) await done.compensate(); await this.store.finish(id, 'FAILED', { code: error.code || 'OPERATION_FAILED', message: error.message }); throw error; }
  }
}
async function retry(run, maxAttempts) { let last; for (let attempt = 0; attempt < maxAttempts; attempt += 1) { try { return await run(); } catch (error) { last = error; if (!error.retryable || attempt + 1 === maxAttempts) throw error; } } throw last; }
class MemoryOperationStore {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.operations = new Map(); this.stepMap = new Map(); }
  async create(input) { const existing = [...this.operations.values()].find(item => item.ownerId === input.ownerId && item.idempotencyKey === input.idempotencyKey); if (existing) return clone(existing); const operation = { id: crypto.randomUUID(), ...clone(input), state: 'QUEUED', cancelRequested: false, leaseOwner: null, leaseUntil: null }; this.operations.set(operation.id, operation); this.stepMap.set(operation.id, new Map()); return clone(operation); }
  async get(id) { return this.operations.has(id) ? clone(this.operations.get(id)) : null; }
  async requestCancel(id, ownerId) { const operation = this.operations.get(id); if (!operation || operation.ownerId !== ownerId) return null; operation.cancelRequested = true; if (operation.state === 'QUEUED') operation.state = 'CANCELLING'; return clone(operation); }
  async leaseNext(runnerId, leaseMs) { const now = this.now(); const operation = [...this.operations.values()].find(item => ['QUEUED', 'CANCELLING', 'EXECUTING'].includes(item.state) && (!item.leaseUntil || item.leaseUntil <= now)); if (!operation) return null; operation.state = 'EXECUTING'; operation.leaseOwner = runnerId; operation.leaseUntil = now + leaseMs; return clone(operation); }
  async upsertStep(operationId, key) { const steps = this.stepMap.get(operationId); if (!steps) throw new Error('Operation not found'); if (!steps.has(key)) steps.set(key, { key, state: 'PENDING', attempt: 0 }); return clone(steps.get(key)); }
  async markStep(operationId, key, state, error = null) { const step = await this.upsertStep(operationId, key); const current = this.stepMap.get(operationId).get(key); current.state = state; if (state === 'RUNNING') current.attempt += 1; current.error = error; return clone(current); }
  async finish(id, state, error = null) { const operation = this.operations.get(id); if (!operation) throw new Error('Operation not found'); operation.state = state; operation.error = error; operation.leaseUntil = null; return clone(operation); }
  async steps(id) { return [...(this.stepMap.get(id)?.values() || [])].map(clone); }
}
module.exports = { OperationService, MemoryOperationStore };
