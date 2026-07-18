'use strict';
class AdmissionError extends Error { constructor(message, code, details) { super(message); this.name = 'AdmissionError'; this.code = code; this.details = details; } }
class AdmissionService {
  constructor({ reservations }) { if (!reservations) throw new TypeError('reservations is required'); this.reservations = reservations; }
  async admit({ plan, host, requiredCapabilities = [] }) {
    if (!plan?.instanceId || !host?.id) throw new AdmissionError('Plan instance and host are required', 'INVALID_ADMISSION_INPUT');
    const missing = requiredCapabilities.filter(capability => !host.capabilities?.includes(capability)); if (missing.length) throw new AdmissionError('Host does not provide required capabilities', 'HOST_CAPABILITY_UNSUPPORTED', { missing });
    return this.reservations.withTransaction(async tx => {
      await tx.lockHost(host.id); const active = await tx.listActive(host.id); const used = totals(active);
      for (const [resource, code] of [['vcpus', 'INSUFFICIENT_VCPU_CAPACITY'], ['memoryMiB', 'INSUFFICIENT_MEMORY_CAPACITY'], ['storageGiB', 'INSUFFICIENT_STORAGE_CAPACITY']]) if ((used[resource] || 0) + (plan.resources?.[resource] || 0) > (host.capacity?.[resource] || 0)) throw new AdmissionError(`Host ${resource} capacity is insufficient`, code, { used: used[resource] || 0, requested: plan.resources?.[resource] || 0, capacity: host.capacity?.[resource] || 0 });
      const claims = claimsFor(plan, host.id); for (const claim of claims) if (claim.type === 'consolePort' && count(active, 'consolePort') + claims.filter(item => item.type === 'consolePort').length > (host.capacity?.consolePorts || 0)) throw new AdmissionError('Host console port capacity is insufficient', 'INSUFFICIENT_CONSOLE_PORT_CAPACITY');
      await tx.reserveMany([...capacityReservations(plan, host.id), ...claims]); return { instanceId: plan.instanceId, hostId: host.id, reservations: [...capacityReservations(plan, host.id), ...claims] };
    });
  }
  async releaseForStoppedInstance(instanceId) { return this.reservations.withTransaction(tx => tx.releaseInstance(instanceId)); }
}
function capacityReservations(plan, hostId) { return [['vcpus', plan.resources?.vcpus], ['memoryMiB', plan.resources?.memoryMiB], ['storageGiB', plan.resources?.storageGiB]].filter(([, quantity]) => quantity > 0).map(([type, quantity]) => ({ instanceId: plan.instanceId, type, key: `${hostId}|${type}|${plan.instanceId}`, quantity })); }
function claimsFor(plan, hostId) { return [ ...(plan.interfaces || []).flatMap(nic => [{ instanceId: plan.instanceId, type: 'tap', key: `${hostId}|tap|${nic.tap}`, quantity: 1 }, { instanceId: plan.instanceId, type: 'mac', key: `${hostId}|mac|${nic.mac}`, quantity: 1 }]), ...(plan.segments || []).map(segment => ({ instanceId: plan.instanceId, type: 'segment', key: `${hostId}|segment|${segment.resourceKey || segment.id}`, quantity: 1 })), ...(plan.consoles || []).filter(console => console.port !== null && console.port !== undefined).map(console => ({ instanceId: plan.instanceId, type: 'consolePort', key: `${hostId}|console|${console.port}`, quantity: 1 })) ].filter((claim, index, all) => all.findIndex(other => other.type === claim.type && other.key === claim.key) === index); }
function totals(items) { return items.reduce((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + item.quantity }), {}); }
function count(items, type) { return items.filter(item => item.type === type).length; }
module.exports = { AdmissionError, AdmissionService, capacityReservations, claimsFor };
