const fs = require('fs').promises;
const path = require('path');
const { ImageError, safeName } = require('./imagePipeline');

function validateLabSpec(spec, limits = {}) {
  const issues = [];
  const nodes = spec?.nodes && !Array.isArray(spec.nodes) ? spec.nodes : {};
  const links = Array.isArray(spec?.links) ? spec.links : [];
  if (spec?.schemaVersion !== 1) issues.push({ path: 'schemaVersion', message: 'schemaVersion must be 1' });
  if (!spec?.metadata?.name) issues.push({ path: 'metadata.name', message: 'metadata.name is required' });
  if (!Object.keys(nodes).length) issues.push({ path: 'nodes', message: 'At least one node is required' });
  if (!Array.isArray(spec?.links)) issues.push({ path: 'links', message: 'links must be an array' });

  let totalCpu = 0;
  let totalMemoryMiB = 0;
  for (const [id, node] of Object.entries(nodes)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)) issues.push({ path: `nodes.${id}`, message: 'Invalid node id' });
    if (!node?.image) issues.push({ path: `nodes.${id}.image`, message: 'image is required' });
    const cpus = Number(node?.resources?.cpus ?? 1);
    const memory = Number(node?.resources?.memoryMiB ?? 1024);
    if (!Number.isInteger(cpus) || cpus < 1 || cpus > (limits.maxCpuPerNode || 64)) issues.push({ path: `nodes.${id}.resources.cpus`, message: 'Invalid CPU allocation' });
    if (!Number.isInteger(memory) || memory < 128 || memory > (limits.maxMemoryMiBPerNode || 262144)) issues.push({ path: `nodes.${id}.resources.memoryMiB`, message: 'Invalid memory allocation' });
    totalCpu += Number.isInteger(cpus) ? cpus : 0;
    totalMemoryMiB += Number.isInteger(memory) ? memory : 0;
  }

  const claimed = new Set();
  for (const [index, link] of links.entries()) {
    const endpoints = [link?.a, link?.b];
    for (const [side, endpoint] of endpoints.entries()) {
      if (!nodes[endpoint?.node]) issues.push({ path: `links.${index}.${side ? 'b' : 'a'}.node`, message: `Unknown node: ${endpoint?.node || '(missing)'}` });
      const claim = `${endpoint?.node}:${endpoint?.interface}`;
      if (claimed.has(claim)) issues.push({ path: `links.${index}`, message: `Interface already connected: ${claim}` });
      claimed.add(claim);
    }
    if (link?.a?.node === link?.b?.node && link?.a?.interface === link?.b?.interface) issues.push({ path: `links.${index}`, message: 'Link cannot connect an interface to itself' });
  }

  if (totalCpu > (limits.maxTotalCpu || 512)) issues.push({ path: 'nodes', message: 'Total CPU allocation exceeds limit' });
  if (totalMemoryMiB > (limits.maxTotalMemoryMiB || 1048576)) issues.push({ path: 'nodes', message: 'Total memory allocation exceeds limit' });

  return {
    valid: issues.length === 0,
    issues,
    summary: { nodes: Object.keys(nodes).length, links: links.length, totalCpu, totalMemoryMiB }
  };
}

function normalizeLabSpec(spec) {
  const result = validateLabSpec(spec);
  if (!result.valid) throw Object.assign(new Error('Invalid lab spec'), { code: 'INVALID_LAB_SPEC', issues: result.issues });
  return {
    schemaVersion: 1,
    metadata: {
      name: spec.metadata.name.trim(),
      description: String(spec.metadata.description || '').trim(),
      tags: [...new Set(spec.metadata.tags || [])].sort()
    },
    nodes: Object.fromEntries(Object.entries(spec.nodes).sort(([a], [b]) => a.localeCompare(b)).map(([id, node]) => [id, {
      image: node.image,
      role: node.role || 'host',
      resources: {
        cpus: Number(node.resources?.cpus ?? 1),
        memoryMiB: Number(node.resources?.memoryMiB ?? 1024)
      },
      position: node.position,
      config: node.config || {}
    }])),
    links: [...spec.links].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  };
}

async function planInstall(isoPath, options = {}) {
  const iso = path.resolve(isoPath);
  if (!(await fs.stat(iso).catch(() => null))?.isFile() || path.extname(iso).toLowerCase() !== '.iso') {
    throw new ImageError('Installer ISO not found', 'INVALID_INSTALLER_SOURCE');
  }

  const name = safeName(options.name || path.basename(iso, '.iso'));
  const cpus = Number(options.cpus || 2);
  const memory = Number(options.memory || 4096);
  const vnc = Number(options.vnc || 5990);
  const diskSize = String(options.diskSize || '32G');
  if (!Number.isInteger(cpus) || cpus < 1 || cpus > 64 || !Number.isInteger(memory) || memory < 512 || !Number.isInteger(vnc) || vnc < 5900 || vnc > 65535 || !/^\d+(?:\.\d+)?[MGT]$/i.test(diskSize)) {
    throw new ImageError('Invalid installer options', 'INVALID_INSTALLER_OPTIONS');
  }

  const root = path.resolve(options.root || process.env.CUSTOM_IMAGES_PATH || path.join(process.cwd(), 'images', 'custom'));
  const target = path.join(root, `${name}.qcow2`);
  const args = [
    '-name', `sandlabx-installer-${name}`,
    '-machine', 'q35,accel=kvm:tcg',
    '-smp', String(cpus),
    '-m', String(memory),
    '-boot', 'order=d,menu=on',
    '-drive', `file=${target},format=qcow2,if=virtio`,
    '-drive', `file=${iso},media=cdrom,readonly=on`,
    '-netdev', 'user,id=net0',
    '-device', 'virtio-net-pci,netdev=net0',
    '-vnc', `0.0.0.0:${vnc - 5900}`,
    '-monitor', 'stdio'
  ];
  if (options.seed) args.splice(args.length - 2, 0, '-drive', `file=${path.resolve(options.seed)},media=cdrom,readonly=on`);

  return {
    schemaVersion: 1,
    id: name,
    target,
    vncPort: vnc,
    createDisk: { command: 'qemu-img', args: ['create', '-f', 'qcow2', target, diskSize] },
    launchInstaller: { command: 'qemu-system-x86_64', args }
  };
}

module.exports = { normalizeLabSpec, planInstall, validateLabSpec };
