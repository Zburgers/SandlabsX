'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const { normalizeCapsule, stableStringify } = require('../modules/capsuleSchema');
const { planNetwork } = require('./networkPlanner');
const { planDisks } = require('./diskPlanner');
const { planConsoles } = require('./consolePlanner');

class PlanCompilationError extends Error { constructor(message, code, details) { super(message); this.name = 'PlanCompilationError'; this.code = code; this.details = details; } }
function hash(value) { return `sha256:${crypto.createHash('sha256').update(stableStringify(value)).digest('hex')}`; }
function immutable(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(immutable); return value; }

function compileExecutionPlan(document, options = {}) {
  const capsule = normalizeCapsule(document, { requireDigests: true });
  const instanceId = required(options.instanceId, 'instanceId'); const host = options.host || {};
  if (host.architecture !== capsule.runtime.architecture) fail('Host architecture is incompatible with capsule', 'INCOMPATIBLE_ARCHITECTURE');
  const profiles = resolveProfiles(document, capsule, options.workloadProfileVersions || {}, host);
  const images = resolveImages(capsule, options.imageVersions || {}, host);
  const network = planNetwork(capsule, instanceId);
  const consoles = planConsoles(capsule, host);
  const disks = planDisks(capsule, instanceId, images, path.resolve(options.overlaysRoot || '/var/lib/sandlabx/overlays'));
  const consoleByNode = new Map(consoles.map(console => [console.nodeId, console])); const interfacesByNode = group(network.interfaces, item => item.nodeId);
  const processes = Object.entries(capsule.nodes).map(([nodeId, node]) => {
    const disk = disks.find(item => item.nodeId === nodeId); const console = consoleByNode.get(nodeId); const profile = profiles[nodeId];
    const args = ['-name', `sandlabx-${instanceId}-${nodeId}`, '-machine', `${profile.machine || 'q35'},accel=${host.acceleration?.includes('kvm') ? 'kvm' : 'tcg'}`, '-smp', String(node.resources.vcpus), '-m', String(node.resources.memoryMiB), '-drive', `file=${disk.overlayPath},format=qcow2,if=virtio`];
    for (const nic of interfacesByNode.get(nodeId) || []) { args.push('-netdev', `tap,id=${nic.netdev},ifname=${nic.tap},script=no,downscript=no`, '-device', `${nic.model},netdev=${nic.netdev},mac=${nic.mac}`); }
    if (console.type === 'vnc') args.push('-vnc', `127.0.0.1:${console.port - 5900}`); else if (console.type === 'serial') args.push('-nographic', '-serial', `telnet:${console.endpoint},server=on,wait=off`);
    return { nodeId, command: 'qemu-system-x86_64', args };
  }).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const resources = Object.values(capsule.nodes).reduce((total, node) => ({ vcpus: total.vcpus + node.resources.vcpus, memoryMiB: total.memoryMiB + node.resources.memoryMiB, storageGiB: total.storageGiB + node.resources.diskGiB, nodeCount: total.nodeCount + 1 }), { vcpus: 0, memoryMiB: 0, storageGiB: 0, nodeCount: 0 });
  const semantic = { capsule: semanticCapsule(capsule), capsuleVersion: options.capsuleVersion?.contentHash || null, imageVersions: Object.fromEntries(Object.entries(images).map(([id, image]) => [id, { id: image.id, digest: image.digest }])), profiles: profiles };
  const plan = { schemaVersion: 2, instanceId, resources, images: Object.fromEntries(Object.entries(images).map(([id, image]) => [id, { id: image.id, digest: image.digest, path: image.storagePath, format: image.format }])), disks, interfaces: network.interfaces, segments: network.segments, consoles, processes, readiness: consoles.filter(console => console.type !== 'none').map(console => ({ nodeId: console.nodeId, type: console.type === 'vnc' ? 'vnc' : 'tcp', endpoint: console.endpoint })), steps: processes.map(process => ({ key: `start:${process.nodeId}`, action: 'startProcess', nodeId: process.nodeId })), compensation: [...disks].reverse().map(disk => ({ action: 'removeOverlay', nodeId: disk.nodeId, path: disk.overlayPath })), ownership: { instanceId, hostId: host.id, labels: { 'sandlabx.io/instance': instanceId } }, semanticHash: hash(semantic) };
  plan.fullHash = hash(plan); return immutable(plan);
}
function resolveImages(capsule, supplied, host) { const result = {}; for (const [alias, image] of Object.entries(capsule.images)) { const version = supplied[alias]; if (!version || version.digest !== image.digest || !version.storagePath) fail(`Image version is not resolved: ${alias}`, 'IMAGE_VERSION_NOT_FOUND', { alias, digest: image.digest }); if (version.architecture && version.architecture !== host.architecture) fail(`Image architecture is unsupported: ${alias}`, 'HOST_CAPABILITY_UNSUPPORTED'); result[alias] = version; } return result; }
function resolveProfiles(document, capsule, supplied, host) { const result = {}; for (const [nodeId, node] of Object.entries(capsule.nodes)) { const profileAlias = document.nodes?.[nodeId]?.workloadProfile; const version = supplied[profileAlias]; if (!profileAlias || !version) fail(`Workload profile version is not resolved: ${nodeId}`, 'WORKLOAD_PROFILE_VERSION_NOT_FOUND', { nodeId, profileAlias }); if (version.architecture !== host.architecture || (version.acceleration?.length && !version.acceleration.some(value => host.acceleration?.includes(value)))) fail(`Host cannot run workload profile: ${nodeId}`, 'HOST_CAPABILITY_UNSUPPORTED', { nodeId }); if (node.resources.vcpus > version.resources.maxVcpus || node.resources.memoryMiB > version.resources.maxMemoryMiB || node.interfaces.length > version.interfaces.max) fail(`Node exceeds workload profile bounds: ${nodeId}`, 'WORKLOAD_PROFILE_LIMIT_EXCEEDED', { nodeId }); result[nodeId] = { id: version.id, architecture: version.architecture, machine: version.machine, acceleration: [...(version.acceleration || [])].sort() }; } return result; }
function semanticCapsule(capsule) { const result = structuredClone(capsule); delete result.metadata.displayName; delete result.metadata.description; for (const node of Object.values(result.nodes)) { delete node.displayName; delete node.presentation; } return result; }
function group(items, key) { const result = new Map(); for (const item of items) { const value = key(item); result.set(value, [...(result.get(value) || []), item]); } return result; }
function required(value, field) { if (!value || typeof value !== 'string') fail(`${field} is required`, 'INVALID_PLAN_INPUT'); return value; }
function fail(message, code, details) { throw new PlanCompilationError(message, code, details); }
module.exports = { PlanCompilationError, compileExecutionPlan };
