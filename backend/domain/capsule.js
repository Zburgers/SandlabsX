'use strict';

const crypto = require('node:crypto');
const { assertIdentifier } = require('./identifiers');

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function normalizeCapsule(document) {
  if (!document || document.kind !== 'LabCapsule') throw new Error('kind must be LabCapsule');
  const normalized = JSON.parse(JSON.stringify(document));
  normalized.apiVersion ||= 'sandlabx.io/v1alpha1';
  normalized.metadata ||= {};
  normalized.metadata.name = assertIdentifier(normalized.metadata.name, 'metadata.name');
  normalized.nodes = Object.fromEntries(Object.entries(normalized.nodes || {}).sort(([a], [b]) => a.localeCompare(b)));
  normalized.links = [...(normalized.links || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  delete normalized.metadata.position;
  delete normalized.metadata.canvas;
  return sortObject(normalized);
}

function validateCapsule(document, context = {}) {
  const issues = [];
  let capsule;
  try { capsule = normalizeCapsule(document); } catch (error) { return [{ path: '$', message: error.message }]; }
  if (!capsule.runtime?.architecture) issues.push({ path: 'runtime.architecture', message: 'is required' });
  if (!capsule.policy?.network || capsule.policy.network.internetEgress !== false) issues.push({ path: 'policy.network.internetEgress', message: 'must be false for isolated capsules' });
  for (const [name, node] of Object.entries(capsule.nodes || {})) {
    if (!node.driver || !node.image) issues.push({ path: `nodes.${name}`, message: 'driver and image are required' });
    for (const iface of node.interfaces || []) if (!iface.id) issues.push({ path: `nodes.${name}.interfaces`, message: 'interface id is required' });
  }
  const endpoints = new Set(Object.entries(capsule.nodes || {}).flatMap(([n, node]) => (node.interfaces || []).map((i) => `${n}:${i.id}`)));
  for (const link of capsule.links || []) for (const endpoint of link.endpoints || []) if (!endpoints.has(endpoint)) issues.push({ path: `links.${link.id}`, message: `unknown endpoint ${endpoint}` });
  if (context.published && Object.values(capsule.images || {}).some((image) => !/^sha256:[a-f0-9]{64}$/.test(image.digest || ''))) issues.push({ path: 'images', message: 'published images require SHA-256 digests' });
  return issues;
}

function hashCapsule(document) {
  const semantic = normalizeCapsule(document);
  delete semantic.metadata.displayName;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(semantic)).digest('hex')}`;
}

module.exports = { normalizeCapsule, validateCapsule, hashCapsule };
