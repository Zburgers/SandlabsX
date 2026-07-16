const crypto = require('node:crypto');

const API_VERSION = 'sandlabx.io/v1alpha1';
const KIND = 'LabCapsule';
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/i;
const LINK_TYPES = new Set(['pointToPoint', 'segment', 'nat']);
const CONSOLE_TYPES = new Set(['serial', 'vnc', 'none']);

class CapsuleValidationError extends Error {
  constructor(issues) {
    super('Invalid Lab Capsule');
    this.name = 'CapsuleValidationError';
    this.code = 'INVALID_CAPSULE';
    this.issues = issues;
  }
}

function issue(path, message, code = 'INVALID_VALUE') {
  return { path, message, code };
}

function endpoint(value) {
  if (typeof value === 'string') {
    const separator = value.indexOf(':');
    if (separator > 0) return { node: value.slice(0, separator), interface: value.slice(separator + 1) };
  }
  if (value && typeof value === 'object') {
    return { node: String(value.node || ''), interface: String(value.interface || '') };
  }
  return { node: '', interface: '' };
}

function validateCapsule(capsule, options = {}) {
  const issues = [];
  const requireDigests = options.requireDigests === true;
  const nodes = capsule?.nodes && !Array.isArray(capsule.nodes) ? capsule.nodes : {};
  const images = capsule?.images && !Array.isArray(capsule.images) ? capsule.images : {};
  const links = Array.isArray(capsule?.links) ? capsule.links : [];

  if (!capsule || typeof capsule !== 'object' || Array.isArray(capsule)) issues.push(issue('', 'Capsule must be an object'));
  if (capsule?.apiVersion !== API_VERSION) issues.push(issue('apiVersion', `apiVersion must be ${API_VERSION}`));
  if (capsule?.kind !== KIND) issues.push(issue('kind', `kind must be ${KIND}`));
  if (!ID_PATTERN.test(String(capsule?.metadata?.name || ''))) issues.push(issue('metadata.name', 'name must be 1-64 safe characters'));
  if (capsule?.metadata?.tags !== undefined && !Array.isArray(capsule.metadata.tags)) issues.push(issue('metadata.tags', 'tags must be an array'));
  if (!Object.keys(images).length) issues.push(issue('images', 'At least one image is required'));
  if (!Object.keys(nodes).length) issues.push(issue('nodes', 'At least one node is required'));
  if (!Array.isArray(capsule?.links)) issues.push(issue('links', 'links must be an array'));

  let totalVcpus = 0;
  let totalMemoryMiB = 0;
  const interfaceClaims = new Set();
  const imageNames = new Set(Object.keys(images));

  for (const [name, image] of Object.entries(images)) {
    if (!ID_PATTERN.test(name)) issues.push(issue(`images.${name}`, 'image key must be 1-64 safe characters'));
    if (!image || typeof image !== 'object') {
      issues.push(issue(`images.${name}`, 'image must be an object'));
      continue;
    }
    if (!image.name || typeof image.name !== 'string') issues.push(issue(`images.${name}.name`, 'image name is required'));
    if (image.digest && !DIGEST_PATTERN.test(String(image.digest))) issues.push(issue(`images.${name}.digest`, 'digest must be sha256 followed by 64 hexadecimal characters', 'INVALID_DIGEST'));
    if (requireDigests && !DIGEST_PATTERN.test(String(image.digest || ''))) issues.push(issue(`images.${name}.digest`, 'published images must be digest-pinned', 'IMAGE_DIGEST_REQUIRED'));
  }

  for (const [nodeId, node] of Object.entries(nodes)) {
    const base = `nodes.${nodeId}`;
    if (!ID_PATTERN.test(nodeId)) issues.push(issue(base, 'node id must be 1-64 safe characters'));
    if (!node || typeof node !== 'object') {
      issues.push(issue(base, 'node must be an object'));
      continue;
    }
    if (!imageNames.has(node.image)) issues.push(issue(`${base}.image`, `unknown image: ${node.image || '(missing)'}`, 'UNKNOWN_IMAGE'));
    if (!node.driver || typeof node.driver !== 'string') issues.push(issue(`${base}.driver`, 'driver is required'));
    const vcpus = Number(node.resources?.vcpus ?? 1);
    const memoryMiB = Number(node.resources?.memoryMiB ?? 1024);
    if (!Number.isInteger(vcpus) || vcpus < 1 || vcpus > 64) issues.push(issue(`${base}.resources.vcpus`, 'vcpus must be an integer between 1 and 64'));
    if (!Number.isInteger(memoryMiB) || memoryMiB < 128 || memoryMiB > 262144) issues.push(issue(`${base}.resources.memoryMiB`, 'memoryMiB must be an integer between 128 and 262144'));
    totalVcpus += Number.isInteger(vcpus) ? vcpus : 0;
    totalMemoryMiB += Number.isInteger(memoryMiB) ? memoryMiB : 0;
    if (!Array.isArray(node.interfaces)) issues.push(issue(`${base}.interfaces`, 'interfaces must be an array'));
    const localInterfaces = new Set();
    for (const [index, nic] of (Array.isArray(node.interfaces) ? node.interfaces : []).entries()) {
      if (!nic || typeof nic.id !== 'string' || !nic.id.trim()) issues.push(issue(`${base}.interfaces.${index}.id`, 'interface id is required'));
      if (localInterfaces.has(nic.id)) issues.push(issue(`${base}.interfaces.${index}.id`, `duplicate interface: ${nic.id}`));
      localInterfaces.add(nic.id);
    }
    const consoleType = node.console?.type || 'none';
    if (!CONSOLE_TYPES.has(consoleType)) issues.push(issue(`${base}.console.type`, `unsupported console type: ${consoleType}`));
  }

  const limits = capsule?.policy?.resources || {};
  if (Number.isFinite(limits.maxVcpus) && totalVcpus > limits.maxVcpus) issues.push(issue('policy.resources.maxVcpus', 'total vCPU allocation exceeds policy'));
  if (Number.isFinite(limits.maxMemoryMiB) && totalMemoryMiB > limits.maxMemoryMiB) issues.push(issue('policy.resources.maxMemoryMiB', 'total memory allocation exceeds policy'));
  if (capsule?.policy?.network?.internetEgress === true && capsule?.runtime?.isolation === 'private') issues.push(issue('policy.network.internetEgress', 'private capsules cannot enable unrestricted internet egress', 'EGRESS_POLICY_CONFLICT'));

  const linkIds = new Set();
  for (const [index, link] of links.entries()) {
    const base = `links.${index}`;
    if (!link || typeof link !== 'object') {
      issues.push(issue(base, 'link must be an object'));
      continue;
    }
    if (!ID_PATTERN.test(String(link.id || ''))) issues.push(issue(`${base}.id`, 'link id is required and must be safe'));
    if (linkIds.has(link.id)) issues.push(issue(`${base}.id`, `duplicate link id: ${link.id}`));
    linkIds.add(link.id);
    if (!LINK_TYPES.has(link.type)) issues.push(issue(`${base}.type`, 'type must be pointToPoint, segment, or nat'));
    const endpoints = Array.isArray(link.endpoints) ? link.endpoints.map(endpoint) : [];
    if (endpoints.length < 1 || (link.type === 'pointToPoint' && endpoints.length !== 2) || (link.type === 'nat' && endpoints.length !== 1)) issues.push(issue(`${base}.endpoints`, 'endpoint count does not match link type'));
    for (const [endpointIndex, target] of endpoints.entries()) {
      if (!nodes[target.node]) issues.push(issue(`${base}.endpoints.${endpointIndex}.node`, `unknown node: ${target.node || '(missing)'}`, 'UNKNOWN_NODE'));
      const nodeInterfaces = new Set((nodes[target.node]?.interfaces || []).map(nic => nic.id));
      if (target.node && !nodeInterfaces.has(target.interface)) issues.push(issue(`${base}.endpoints.${endpointIndex}.interface`, `unknown interface: ${target.node}:${target.interface}`, 'UNKNOWN_INTERFACE'));
      const claim = `${target.node}:${target.interface}`;
      if (interfaceClaims.has(claim)) issues.push(issue(`${base}.endpoints.${endpointIndex}`, `interface already connected: ${claim}`, 'INTERFACE_REUSED'));
      interfaceClaims.add(claim);
    }
  }

  for (const [index, scenario] of (Array.isArray(capsule?.scenarios) ? capsule.scenarios : []).entries()) {
    if (!scenario || typeof scenario !== 'object') issues.push(issue(`scenarios.${index}`, 'scenario must be an object'));
    for (const [checkIndex, check] of (Array.isArray(scenario?.checks) ? scenario.checks : []).entries()) {
      if (!['topologyPlan', 'fileContains', 'serialOutput'].includes(check?.type)) issues.push(issue(`scenarios.${index}.checks.${checkIndex}.type`, 'unsupported typed check', 'UNSUPPORTED_CHECK'));
      if (check?.type === 'command' && capsule?.policy?.execution?.allowAuthorScripts !== true) issues.push(issue(`scenarios.${index}.checks.${checkIndex}`, 'author scripts are disabled by policy', 'AUTHOR_SCRIPTS_DISABLED'));
    }
  }

  return { valid: issues.length === 0, issues, summary: { nodes: Object.keys(nodes).length, links: links.length, totalVcpus, totalMemoryMiB } };
}

function normalizeCapsule(capsule, options = {}) {
  const validation = validateCapsule(capsule, options);
  if (!validation.valid) throw new CapsuleValidationError(validation.issues);
  const normalized = {
    apiVersion: API_VERSION,
    kind: KIND,
    metadata: {
      name: String(capsule.metadata.name).trim(),
      displayName: String(capsule.metadata.displayName || capsule.metadata.name).trim(),
      description: String(capsule.metadata.description || '').trim(),
      tags: [...new Set((capsule.metadata.tags || []).map(String))].sort()
    },
    runtime: {
      architecture: capsule.runtime?.architecture || 'x86_64',
      acceleration: capsule.runtime?.acceleration || 'preferred',
      isolation: capsule.runtime?.isolation || 'private',
      estimatedDurationMinutes: capsule.runtime?.estimatedDurationMinutes ?? null
    },
    policy: {
      resources: {
        maxVcpus: Number(capsule.policy?.resources?.maxVcpus ?? 512),
        maxMemoryMiB: Number(capsule.policy?.resources?.maxMemoryMiB ?? 1048576),
        maxDiskGiB: Number(capsule.policy?.resources?.maxDiskGiB ?? 4096)
      },
      network: {
        internetEgress: capsule.policy?.network?.internetEgress === true,
        externalConnectors: [...(capsule.policy?.network?.externalConnectors || [])].sort()
      },
      execution: { allowAuthorScripts: capsule.policy?.execution?.allowAuthorScripts === true }
    },
    images: Object.fromEntries(Object.entries(capsule.images).sort(([a], [b]) => a.localeCompare(b)).map(([id, image]) => [id, {
      source: image.source || 'managed',
      name: String(image.name).trim(),
      digest: image.digest || null,
      compatibility: image.compatibility || null
    }])),
    nodes: Object.fromEntries(Object.entries(capsule.nodes).sort(([a], [b]) => a.localeCompare(b)).map(([id, node]) => [id, {
      displayName: String(node.displayName || id).trim(),
      driver: node.driver,
      image: node.image,
      role: node.role || 'host',
      resources: { vcpus: Number(node.resources?.vcpus ?? 1), memoryMiB: Number(node.resources?.memoryMiB ?? 1024), diskGiB: Number(node.resources?.diskGiB ?? 10) },
      interfaces: [...(node.interfaces || [])].map(nic => ({ id: nic.id, guestName: nic.guestName || null, model: nic.model || 'virtio' })).sort((a, b) => a.id.localeCompare(b.id)),
      console: { type: node.console?.type || 'none' },
      bootstrap: node.bootstrap || null,
      presentation: node.position ? { position: { x: Number(node.position.x) || 0, y: Number(node.position.y) || 0 } } : null
    }])),
    links: [...capsule.links].map(link => ({
      id: link.id,
      type: link.type || 'pointToPoint',
      endpoints: (link.endpoints || [link.a, link.b]).map(endpoint),
      impairment: link.impairment || null
    })).sort((a, b) => a.id.localeCompare(b.id)),
    scenarios: [...(capsule.scenarios || [])].map(scenario => ({
      id: scenario.id,
      title: scenario.title || scenario.id,
      instructions: scenario.instructions || [],
      stages: scenario.stages || [],
      checks: scenario.checks || [],
      checkpoints: scenario.checkpoints || []
    })).sort((a, b) => String(a.id).localeCompare(String(b.id)))
  };
  return normalized;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function capsuleHash(capsule) {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(capsule)).digest('hex')}`;
}

function convertLegacyTopology(topology, metadata = {}) {
  const warnings = [];
  const images = {};
  const nodes = {};
  for (const node of topology?.nodes || []) {
    const osType = node.osType || node.data?.osType || 'ubuntu';
    const imageName = node.image?.name || node.image || osType;
    const imageId = String(imageName).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'legacy-image';
    images[imageId] = { source: 'legacy', name: imageName, digest: null };
    nodes[node.id] = {
      displayName: node.name || node.data?.label || node.id,
      driver: osType === 'router' ? 'qemu-serial-router' : 'qemu-linux-cloud',
      image: imageId,
      role: osType === 'router' ? 'router' : 'host',
      resources: { vcpus: Number(node.data?.vcpus ?? node.resources?.cpus ?? 1), memoryMiB: Number(node.data?.memoryMb ?? node.resources?.memoryMiB ?? 1024) },
      interfaces: [],
      console: { type: osType === 'router' ? 'serial' : 'vnc' },
      position: node.position
    };
    warnings.push({ code: 'IMAGE_DIGEST_REQUIRED', path: `images.${imageId}.digest`, message: `Resolve an immutable digest for legacy image ${imageName}` });
  }
  const links = (topology?.edges || []).map((edge, index) => {
    const a = { node: edge.source, interface: edge.sourceInterface || edge.data?.sourceInterface || 'eth0' };
    const b = { node: edge.target, interface: edge.targetInterface || edge.data?.targetInterface || 'eth0' };
    for (const target of [a, b]) if (nodes[target.node] && !nodes[target.node].interfaces.some(nic => nic.id === target.interface)) nodes[target.node].interfaces.push({ id: target.interface });
    return { id: edge.id || `legacy-link-${index + 1}`, type: edge.type === 'bridge' ? 'segment' : 'pointToPoint', endpoints: [a, b] };
  });
  return {
    capsule: normalizeCapsule({
      apiVersion: API_VERSION,
      kind: KIND,
      metadata: { name: String(metadata.name || 'legacy-lab').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'legacy-lab', displayName: metadata.displayName || metadata.name || 'Legacy lab', description: metadata.description, tags: metadata.tags },
      images, nodes, links, scenarios: []
    }),
    warnings,
    requiresImageResolution: true
  };
}

module.exports = { API_VERSION, KIND, CapsuleValidationError, capsuleHash, convertLegacyTopology, normalizeCapsule, stableStringify, validateCapsule };

