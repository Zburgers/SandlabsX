'use strict';
class Runner {
  constructor({ id, operations, handlers, leaseMs = 30_000 }) { if (!id || !operations || !handlers) throw new TypeError('id, operations, and handlers are required'); this.id = id; this.operations = operations; this.handlers = handlers; this.leaseMs = leaseMs; }
  async runOnce() { const operation = await this.operations.leaseNext(this.id, this.leaseMs); if (!operation) return null; try { const factory = this.handlers[operation.type]; if (!factory) throw Object.assign(new Error(`No handler for ${operation.type}`), { code: 'UNSUPPORTED_OPERATION' }); const handlers = factory(operation); return await this.operations.execute(operation.id, handlers, { runnerId: this.id }); } catch (error) { const current = await this.operations.get(operation.id); if (current?.state === 'EXECUTING') await this.operations.finish(operation.id, 'FAILED', { code: error.code || 'OPERATION_FAILED', message: String(error.message || 'Operation failed').slice(0, 1024) }); throw error; } }
}
module.exports = { Runner };
