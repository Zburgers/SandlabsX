'use strict';
const crypto = require('node:crypto');

function digest(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function hostToken(prefix, value, maximum = 15) { return `${prefix}-${digest(value).slice(0, Math.max(1, maximum - prefix.length - 1))}`; }
function macFor(instanceId, nodeId, interfaceId) { const bytes = Buffer.from(digest(`${instanceId}|${nodeId}|${interfaceId}`), 'hex'); bytes[0] = (bytes[0] & 0xfc) | 0x02; return [...bytes.subarray(0, 6)].map(byte => byte.toString(16).padStart(2, '0')).join(':'); }

function planNetwork(capsule, instanceId) {
  const claimed = new Map();
  for (const link of capsule.links) for (const endpoint of link.endpoints) claimed.set(`${endpoint.node}:${endpoint.interface}`, link.id);
  const interfaces = Object.entries(capsule.nodes).flatMap(([nodeId, node]) => node.interfaces.map(nic => ({
    nodeId, interfaceId: nic.id, model: nic.model || 'virtio-net-pci', mac: macFor(instanceId, nodeId, nic.id),
    tap: hostToken('tap', `${instanceId}|${nodeId}|${nic.id}`), netdev: hostToken('net', `${instanceId}|${nodeId}|${nic.id}`, 31),
    segmentId: claimed.get(`${nodeId}:${nic.id}`) || null,
  }))).sort(compareInterface);
  const byEndpoint = new Map(interfaces.map(item => [`${item.nodeId}:${item.interfaceId}`, item]));
  const segments = capsule.links.map(link => ({
    id: link.id, type: link.type, resourceKey: `${instanceId}|${link.id}`,
    hostBridge: hostToken('br', `${instanceId}|${link.id}`),
    endpoints: link.endpoints.map(endpoint => { const nic = byEndpoint.get(`${endpoint.node}:${endpoint.interface}`); return { nodeId: endpoint.node, interfaceId: endpoint.interface, tap: nic.tap, mac: nic.mac }; }).sort(compareInterface),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return { interfaces, segments };
}
function compareInterface(a, b) { return `${a.nodeId}:${a.interfaceId}`.localeCompare(`${b.nodeId}:${b.interfaceId}`); }
module.exports = { hostToken, macFor, planNetwork };
