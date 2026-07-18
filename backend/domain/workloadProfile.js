'use strict';

function validateWorkloadProfile(profile) {
  const issues = [];
  if (!profile || typeof profile !== 'object') return ['profile must be an object'];
  for (const key of ['id', 'version', 'architecture', 'machine', 'console']) if (!profile[key]) issues.push(`${key} is required`);
  if (profile.resources && (!Number.isInteger(profile.resources.minVcpus) || !Number.isInteger(profile.resources.maxVcpus) || profile.resources.minVcpus < 1 || profile.resources.minVcpus > profile.resources.maxVcpus)) issues.push('resources vCPU bounds are invalid');
  if (profile.resources && (!Number.isInteger(profile.resources.minMemoryMiB) && profile.resources.minMemoryMiB !== undefined || !Number.isInteger(profile.resources.maxMemoryMiB) && profile.resources.maxMemoryMiB !== undefined || profile.resources.minMemoryMiB > profile.resources.maxMemoryMiB)) issues.push('resources memory bounds are invalid');
  if (profile.interfaces && (!Number.isInteger(profile.interfaces.max) || profile.interfaces.max < 0)) issues.push('interfaces.max is invalid');
  if (profile.interfaces?.models && (!Array.isArray(profile.interfaces.models) || profile.interfaces.models.length === 0 || profile.interfaces.models.some((model) => typeof model !== 'string' || !model))) issues.push('interfaces.models are invalid');
  if (profile.disks && (!Number.isInteger(profile.disks.max) || profile.disks.max < 0 || !Array.isArray(profile.disks.formats) || profile.disks.formats.length === 0)) issues.push('disks are invalid');
  if (profile.capabilities && Object.values(profile.capabilities).some((capability) => typeof capability !== 'boolean')) issues.push('capabilities must be booleans');
  return issues;
}

module.exports = { validateWorkloadProfile };
