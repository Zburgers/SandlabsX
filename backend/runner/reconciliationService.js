'use strict';
const { assertOwned } = require('../runtime/ownership');
class ReconciliationService {
  constructor({ qemu, network }) { if (!qemu || !network) throw new TypeError('qemu and network are required'); this.qemu = qemu; this.network = network; }
  async reconcileProcess(resource) { const observed = await this.qemu.observe(resource); if (!observed) return { classification: 'MISSING' }; if (observed.command === resource.identity.command && JSON.stringify(observed.args) === JSON.stringify(resource.identity.args)) return { classification: 'ADOPTED', observed }; return { classification: 'PID_REUSED', observed }; }
  async cleanupOrphanTap(resource, ownership) { assertOwned(resource, ownership); await this.network.deleteTap(resource, ownership); return { classification: 'CLEANED' }; }
}
module.exports = { ReconciliationService };
