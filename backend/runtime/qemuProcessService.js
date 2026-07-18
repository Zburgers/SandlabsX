'use strict';
const { OwnershipError, requireIdentity, assertOwned } = require('./ownership');
class QemuProcessService {
  constructor({ runner, readiness = async () => true }) { if (!runner?.spawn || !runner.inspectProcess || !runner.signal) throw new TypeError('runner spawn, inspectProcess, and signal are required'); this.runner = runner; this.readiness = readiness; }
  async start(input) { const ownership = requireIdentity(input); const launched = await this.runner.spawn(input.command, input.args, { correlationId: input.correlationId }); return { ...launched, ownership, identity: { command: input.command, args: [...input.args] } }; }
  async observe(resource) { assertOwned(resource, resource.ownership); return this.runner.inspectProcess(resource.pid); }
  async ready(resource) { assertOwned(resource, resource.ownership); return Boolean(await this.readiness(resource)); }
  async stop(resource, { force = false } = {}) { assertOwned(resource, resource.ownership); const observed = await this.runner.inspectProcess(resource.pid); if (!observed || observed.command !== resource.identity.command || JSON.stringify(observed.args) !== JSON.stringify(resource.identity.args)) throw new OwnershipError('Process identity cannot be verified', 'PROCESS_IDENTITY_MISMATCH'); await this.runner.signal(resource.pid, force ? 'SIGKILL' : 'SIGTERM'); }
}
module.exports = { QemuProcessService, OwnershipError };
