const path = require('node:path');
const { capsuleHash, normalizeCapsule, stableStringify } = require('./capsuleSchema');
const { createDefaultDriverRegistry } = require('./driverRegistry');
const { allocateNetwork } = require('./networkAllocator');

class PlanCompilationError extends Error {
  constructor(message, code, details) { super(message); this.name = 'PlanCompilationError'; this.code = code; this.details = details; }
}

function compilePlan(input, options = {}) {
  const capsule = normalizeCapsule(input, { requireDigests: true });
  const instanceId = String(options.instanceId || 'instance');
  const host = { architecture: 'x86_64', acceleration: 'tcg', maxVcpus: 512, maxMemoryMiB: 1048576, vncPortStart: 5900, ...(options.hostCapabilities || {}) };
  if (capsule.runtime.architecture !== host.architecture) throw new PlanCompilationError('Host architecture is incompatible with capsule', 'INCOMPATIBLE_ARCHITECTURE');
  const totalVcpus = Object.values(capsule.nodes).reduce((sum, node) => sum + node.resources.vcpus, 0);
  const totalMemoryMiB = Object.values(capsule.nodes).reduce((sum, node) => sum + node.resources.memoryMiB, 0);
  if (totalVcpus > host.maxVcpus || totalMemoryMiB > host.maxMemoryMiB) throw new PlanCompilationError('Host capacity is insufficient', 'INSUFFICIENT_CAPACITY', { totalVcpus, totalMemoryMiB, host });
  const imagePaths = options.imagePaths || {};
  for (const [imageId, image] of Object.entries(capsule.images)) if (!imagePaths[imageId] && !image.path) throw new PlanCompilationError(`No managed path for image ${imageId}`, 'IMAGE_PATH_MISSING', { imageId, digest: image.digest });
  const registry = options.driverRegistry || createDefaultDriverRegistry();
  const network = allocateNetwork(capsule, instanceId, { vncPortStart: host.vncPortStart, usedPorts: host.usedVncPorts });
  const byNode = new Map();
  for (const allocation of network.interfaces) {
    if (!byNode.has(allocation.nodeId)) byNode.set(allocation.nodeId, []);
    byNode.get(allocation.nodeId).push(allocation);
  }
  const overlaysRoot = path.resolve(options.overlaysRoot || '/var/lib/sandlabx/overlays');
  const nodes = Object.entries(capsule.nodes).sort(([a], [b]) => a.localeCompare(b)).map(([nodeId, node], nodeIndex) => {
    const driver = registry.get(node.driver);
    if (typeof driver.validate === 'function') driver.validate(node, capsule.images[node.image], host);
    const overlayPath = path.join(overlaysRoot, instanceId, `${nodeId}.qcow2`);
    const image = capsule.images[node.image];
    const interfaces = byNode.get(nodeId) || [];
    const consolePort = driver.consoleType === 'serial' ? 7000 + nodeIndex : network.ports[nodeId];
    const processArgs = driver.compileProcess(node, { instanceId, nodeId, acceleration: host.acceleration, overlayPath, interfaces, consolePort });
    return {
      id: nodeId,
      driver: node.driver,
      image: { name: image.name, digest: image.digest, path: imagePaths[node.image] || image.path },
      resources: node.resources,
      interfaces,
      console: driver.consoleType === 'vnc' ? { type: 'vnc', port: network.ports[nodeId] } : { type: driver.consoleType, port: consolePort },
      disk: { overlayPath, baseImage: imagePaths[node.image] || image.path, action: 'createOverlay' },
      process: { command: 'qemu-system-x86_64', args: processArgs },
      readiness: driver.consoleType === 'serial' ? { type: 'tcp', host: '127.0.0.1', port: consolePort } : { type: 'vnc', port: network.ports[nodeId] },
      compensation: [{ type: 'removeOverlay', path: overlayPath }]
    };
  });
  const plan = {
    schemaVersion: 1,
    capsuleVersionHash: capsuleHash(semanticCapsule(capsule)),
    instanceId,
    resources: { totalVcpus, totalMemoryMiB, nodeCount: nodes.length },
    images: Object.fromEntries(Object.entries(capsule.images).map(([id, image]) => [id, { digest: image.digest, path: imagePaths[id] || image.path }])),
    network,
    nodes,
    cleanup: [...network.interfaces.map(nic => ({ type: 'deleteTap', name: nic.tap })), ...network.segments.map(segment => ({ type: 'deleteSegment', id: segment.id, bridge: segment.hostBridge }))]
  };
  plan.planHash = `sha256:${require('node:crypto').createHash('sha256').update(stableStringify(plan)).digest('hex')}`;
  return plan;
}

function semanticCapsule(capsule) {
  const semantic = structuredClone(capsule);
  delete semantic.metadata.displayName;
  delete semantic.metadata.description;
  delete semantic.metadata.tags;
  for (const node of Object.values(semantic.nodes)) {
    delete node.displayName;
    delete node.presentation;
  }
  return semantic;
}

module.exports = { PlanCompilationError, compilePlan };
