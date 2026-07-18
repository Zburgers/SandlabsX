'use strict';
function planConsoles(capsule, host) {
  const used = new Set(host.usedConsolePorts || []); let next = Number(host.vncPortStart || 5900); const end = Number(host.vncPortEnd || 5999);
  return Object.entries(capsule.nodes).sort(([a], [b]) => a.localeCompare(b)).map(([nodeId, node], index) => {
    if (node.console.type === 'vnc') { while (used.has(next) && next <= end) next += 1; if (next > end) throw codeError('No console ports remain on host', 'CONSOLE_PORT_CAPACITY_EXCEEDED'); const port = next; used.add(port); next += 1; return { nodeId, type: 'vnc', port, endpoint: `127.0.0.1:${port}` }; }
    if (node.console.type === 'serial') { const port = Number(host.serialPortStart || 7000) + index; return { nodeId, type: 'serial', port, endpoint: `127.0.0.1:${port}` }; }
    return { nodeId, type: 'none', port: null, endpoint: null };
  });
}
function codeError(message, code) { return Object.assign(new Error(message), { code }); }
module.exports = { planConsoles };
