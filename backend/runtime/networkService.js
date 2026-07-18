'use strict';
const { OwnershipError, requireIdentity, assertOwned } = require('./ownership');
class NetworkService {
  constructor({ runner }) { if (!runner?.run || !runner.inspectLink) throw new TypeError('runner with run and inspectLink is required'); this.runner = runner; }
  async createSegment(input) { const ownership = requireIdentity({ instanceId: input.instanceId, nodeId: '_segment' }); await this.command(['link', 'add', input.bridge, 'type', 'bridge']); await this.command(['link', 'set', input.bridge, 'up']); return { id: input.id, bridge: input.bridge, ownership }; }
  async deleteSegment(resource, ownership) { assertOwned(resource, ownership); await this.command(['link', 'del', resource.bridge]); }
  async createTap(input) { const ownership = requireIdentity(input); assertOwned(input.segment, { instanceId: ownership.instanceId, nodeId: '_segment' }); await this.command(['tuntap', 'add', 'dev', input.name, 'mode', 'tap']); await this.command(['link', 'set', input.name, 'master', input.segment.bridge]); await this.command(['link', 'set', input.name, 'up']); return { name: input.name, segment: input.segment.bridge, ownership }; }
  async observeTap(resource) { return this.runner.inspectLink(resource.name); }
  async setLinkState(resource, up, ownership) { assertOwned(resource, ownership); await this.command(['link', 'set', resource.name, up ? 'up' : 'down']); }
  async deleteTap(resource, ownership) { assertOwned(resource, ownership); await this.command(['link', 'del', resource.name]); }
  async command(args) { const result = await this.runner.run('ip', args); if (result.code !== 0) throw new Error(`ip ${args.join(' ')} failed`); }
}
module.exports = { NetworkService, OwnershipError };
