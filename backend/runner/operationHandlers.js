'use strict';
function createOperationHandlers({ disk, network, qemu, console: consoleService, checkpoints, capture }) {
  const identity = (operation, value = {}) => ({ ...value, instanceId: operation.instanceId, nodeId: value.nodeId });
  const input = operation => operation.input || {};
  const plan = operation => input(operation).plan || {};
  return {
    PLAN: operation => [{ key: 'plan', run: async () => { if (!input(operation).plan) throw codeError('Execution plan is required', 'PLAN_REQUIRED'); return input(operation).plan; } }],
    PROVISION: operation => {
      const segments = new Map(); const created = new Map(); const steps = [];
      for (const item of plan(operation).disks || []) steps.push({ key: `disk:${item.nodeId}`, run: async () => created.set(`disk:${item.nodeId}`, await disk.createOverlay(identity(operation, item))), compensate: async () => created.has(`disk:${item.nodeId}`) && disk.removeOverlay(created.get(`disk:${item.nodeId}`), identity(operation, item)) });
      for (const item of plan(operation).segments || []) steps.push({ key: `segment:${item.id}`, run: async () => segments.set(item.id, await network.createSegment({ ...item, bridge: item.hostBridge, instanceId: operation.instanceId })), compensate: async () => segments.has(item.id) && network.deleteSegment(segments.get(item.id), { instanceId: operation.instanceId, nodeId: '_segment' }) });
      for (const item of (plan(operation).interfaces || []).filter(value => value.segmentId)) steps.push({ key: `tap:${item.nodeId}:${item.interfaceId || item.tap}`, run: async () => created.set(`tap:${item.nodeId}:${item.interfaceId || item.tap}`, await network.createTap({ ...identity(operation, item), name: item.tap, segment: segments.get(item.segmentId) })), compensate: async () => { const resource = created.get(`tap:${item.nodeId}:${item.interfaceId || item.tap}`); if (resource) await network.deleteTap(resource, identity(operation, item)); } });
      for (const item of plan(operation).consoles || []) steps.push({ key: `console:${item.nodeId}`, run: async () => created.set(`console:${item.nodeId}`, await consoleService.register(identity(operation, item))), compensate: async () => { const resource = created.get(`console:${item.nodeId}`); if (resource) await consoleService.unregister(resource, identity(operation, item)); } });
      return steps;
    },
    START: operation => (plan(operation).processes || []).map(item => { let resource; return { key: `start:${item.nodeId}`, run: async () => { resource = await qemu.start(identity(operation, item)); if (!await qemu.ready(resource)) throw codeError(`Node ${item.nodeId} did not become ready`, 'READINESS_FAILED'); return resource; }, compensate: async () => resource && qemu.stop(resource) }; }),
    STOP: operation => (input(operation).processes || []).map(resource => ({ key: `stop:${resource.ownership.nodeId}`, run: () => qemu.stop(resource) })),
    LINK_STATE: operation => [{ key: `link-state:${input(operation).interface?.name || 'unknown'}`, run: () => network.setLinkState(input(operation).interface, Boolean(input(operation).up), input(operation).ownership) }],
    CHECKPOINT: operation => [{ key: 'checkpoint', run: () => checkpoints.create(input(operation).instance, operation.ownerId, input(operation).nodes, input(operation).options) }],
    RESTORE: operation => [{ key: 'restore', run: () => checkpoints.restore(input(operation).instance, operation.ownerId, input(operation).checkpoint) }],
    RESET: operation => [{ key: 'reset', run: () => checkpoints.restore(input(operation).instance, operation.ownerId, input(operation).baselineCheckpoint) }],
    CAPTURE: operation => [{ key: 'capture', run: () => capture.capture(input(operation)) }],
    DESTROY: operation => destroySteps(operation, input(operation), { disk, network, qemu, consoleService }),
  };
}
function destroySteps(operation, value, ports) { const steps = []; for (const resource of value.consoles || []) steps.push({ key: `destroy:console:${resource.ownership.nodeId}`, run: () => ports.consoleService.unregister(resource, resource.ownership) }); for (const resource of value.processes || []) steps.push({ key: `destroy:process:${resource.ownership.nodeId}`, run: () => ports.qemu.stop(resource, { force: Boolean(value.force) }) }); for (const resource of value.taps || []) steps.push({ key: `destroy:tap:${resource.ownership.nodeId}`, run: () => ports.network.deleteTap(resource, resource.ownership) }); for (const resource of value.segments || []) steps.push({ key: `destroy:segment:${resource.id}`, run: () => ports.network.deleteSegment(resource, resource.ownership) }); for (const resource of value.disks || []) steps.push({ key: `destroy:disk:${resource.ownership.nodeId}`, run: () => ports.disk.removeOverlay(resource, resource.ownership) }); if (!steps.length) throw codeError(`Destroy operation ${operation.instanceId} has no owned resources`, 'OWNED_RESOURCES_REQUIRED'); return steps; }
function codeError(message, code) { return Object.assign(new Error(message), { code }); }
module.exports = { createOperationHandlers };
