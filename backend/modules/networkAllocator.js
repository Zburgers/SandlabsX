const crypto = require('node:crypto');

function digest(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function macFor(instanceId, nodeId, interfaceId) {
  const bytes = Buffer.from(digest(`${instanceId}|${nodeId}|${interfaceId}`), 'hex');
  bytes[0] = (bytes[0] & 0xfc) | 0x02;
  return [...bytes.subarray(0, 6)].map(byte => byte.toString(16).padStart(2, '0')).join(':');
}

function token(prefix, value, length = 10) { return `${prefix}-${digest(value).slice(0, length)}`; }

function allocateNetwork(capsule, instanceId, options = {}) {
  const interfacesByKey = new Map();
  for (const [nodeId, node] of Object.entries(capsule.nodes)) {
    for (const nic of node.interfaces) {
      const key = `${nodeId}:${nic.id}`;
      interfacesByKey.set(key, { nodeId, interfaceId: nic.id, mac: macFor(instanceId, nodeId, nic.id), tap: token('tap', `${instanceId}|${nodeId}|${nic.id}`), netdev: token('net', `${instanceId}|${nodeId}|${nic.id}`), model: nic.model });
    }
  }
  const segments = [];
  const interfaces = [];
  const claims = new Set();
  for (const link of capsule.links) {
    const segment = {
      id: link.id,
      type: link.type,
      hostBridge: link.type === 'segment' || link.type === 'nat' ? token('br', `${instanceId}|${link.id}`) : null,
      resourceKey: `${instanceId}|${link.id}`,
      endpoints: []
    };
    for (const target of link.endpoints) {
      const key = `${target.node}:${target.interface}`;
      const nic = interfacesByKey.get(key);
      if (!nic) throw Object.assign(new Error(`Network interface not found: ${key}`), { code: 'NETWORK_INTERFACE_MISSING' });
      if (claims.has(key)) throw Object.assign(new Error(`Network interface allocated twice: ${key}`), { code: 'NETWORK_INTERFACE_DUPLICATE' });
      claims.add(key);
      const allocation = { ...nic, segmentId: link.id };
      interfaces.push(allocation);
      segment.endpoints.push({ nodeId: target.node, interfaceId: target.interface, tap: nic.tap, mac: nic.mac });
    }
    segments.push(segment);
  }
  const ports = allocatePorts(capsule, instanceId, options);
  return { interfaces, segments, ports };
}

function allocatePorts(capsule, instanceId, options = {}) {
  const used = new Set(options.usedPorts || []);
  let next = Number(options.vncPortStart || 5900);
  const result = {};
  for (const nodeId of Object.keys(capsule.nodes).sort()) {
    if ((capsule.nodes[nodeId].console?.type || 'none') !== 'vnc') continue;
    while (used.has(next)) next += 1;
    result[nodeId] = next;
    used.add(next);
    next += 1;
  }
  return result;
}

module.exports = { allocateNetwork, allocatePorts, macFor, token };
