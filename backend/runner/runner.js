'use strict';
class Runner {
  constructor({ id, operations, handlers, leaseMs = 30_000 }) { if (!id || !operations || !handlers) throw new TypeError('id, operations, and handlers are required'); this.id = id; this.operations = operations; this.handlers = handlers; this.leaseMs = leaseMs; }
  async runOnce() { const operation = await this.operations.leaseNext(this.id, this.leaseMs); if (!operation) return null; const factory = this.handlers[operation.type]; if (!factory) throw Object.assign(new Error(`No handler for ${operation.type}`), { code: 'UNSUPPORTED_OPERATION' }); return this.operations.execute(operation.id, factory(operation), { runnerId: this.id }); }
}
module.exports = { Runner };
