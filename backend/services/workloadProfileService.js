'use strict';

const crypto = require('node:crypto');
const { validateWorkloadProfile } = require('../domain/workloadProfile');

class WorkloadProfileService {
  constructor({ repository }) {
    if (!repository) throw new TypeError('repository is required');
    this.repository = repository;
  }

  async publish(profile, client) {
    this.assertValid(profile);
    const normalized = normalizeProfile(profile);
    return immutable(await this.repository.createVersion({
      name: normalized.name || normalized.id,
      contentHash: contentHash(normalized),
      profile: normalized,
    }, client));
  }

  async resolveWorkloadProfileVersion(profileVersionId, client) {
    const profile = await this.repository.getVersion(profileVersionId, client);
    if (!profile) throw codeError('Workload profile version not found', 'WORKLOAD_PROFILE_VERSION_NOT_FOUND');
    return immutable(profile);
  }

  async listWorkloadProfileVersions(client) { return Object.freeze((await this.repository.listVersions(client)).map(immutable)); }

  validateNodeOverrides(profile, overrides) { return validateNodeOverrides(profile, overrides); }

  validate(profile) {
    const issues = validateWorkloadProfile(profile);
    return Object.freeze({ valid: issues.length === 0, issues: Object.freeze([...issues]) });
  }

  assertValid(profile) {
    const result = this.validate(profile);
    if (!result.valid) throw codeError(`Invalid workload profile: ${result.issues.join('; ')}`, 'INVALID_WORKLOAD_PROFILE', { issues: result.issues });
  }
}

function validateNodeOverrides(profile, overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw codeError('Node overrides must be an object', 'INVALID_NODE_OVERRIDES');
  const allowed = new Set(profile.permittedNodeOverrides || []);
  const result = {};
  for (const [group, values] of Object.entries(overrides)) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw codeError(`Override ${group} must be an object`, 'INVALID_NODE_OVERRIDES');
    for (const [key, value] of Object.entries(values)) {
      const path = `${group}.${key}`;
      if (!allowed.has(path)) throw codeError(`Override is not permitted: ${path}`, 'INVALID_NODE_OVERRIDES');
      if (path === 'resources.vcpus' && (!Number.isInteger(value) || value < profile.resources.minVcpus || value > profile.resources.maxVcpus)) throw codeError('vCPU override is outside profile bounds', 'INVALID_NODE_OVERRIDES');
      if (path === 'resources.memoryMiB' && (!Number.isInteger(value) || value < profile.resources.minMemoryMiB || value > profile.resources.maxMemoryMiB)) throw codeError('Memory override is outside profile bounds', 'INVALID_NODE_OVERRIDES');
      if (path === 'console.type' && !profile.consoles?.includes(value)) throw codeError('Console override is not supported by profile', 'INVALID_NODE_OVERRIDES');
      result[group] ||= {};
      result[group][key] = value;
    }
  }
  return immutable(result);
}

function createProfileResolutionInterfaces({ imageArtifacts, workloadProfiles }) {
  if (!imageArtifacts || !workloadProfiles) throw new TypeError('imageArtifacts and workloadProfiles are required');
  return Object.freeze({
    resolveImageVersion: imageArtifacts.resolveImageVersion.bind(imageArtifacts),
    resolveWorkloadProfileVersion: workloadProfiles.resolveWorkloadProfileVersion.bind(workloadProfiles),
    validateNodeOverrides: workloadProfiles.validateNodeOverrides.bind(workloadProfiles),
    assertImageCompatibility: imageArtifacts.assertImageCompatibility.bind(imageArtifacts),
  });
}

function normalizeProfile(profile) { return sortObject(structuredClone(profile)); }
function contentHash(profile) { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex')}`; }
function sortObject(value) { if (Array.isArray(value)) return value.map(sortObject); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortObject(value[key])])); }
function immutable(value) { return Object.freeze(structuredClone(value)); }
function codeError(message, code, details) { return Object.assign(new Error(message), { code, details }); }

module.exports = { WorkloadProfileService, contentHash, createProfileResolutionInterfaces, validateNodeOverrides };
