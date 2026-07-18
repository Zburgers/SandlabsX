'use strict';

function validateWorkloadProfile(profile) {
  const issues = [];
  if (!profile || typeof profile !== 'object') return ['profile must be an object'];
  for (const key of ['id', 'version', 'architecture', 'machine', 'console']) if (!profile[key]) issues.push(`${key} is required`);
  if (profile.resources && (!Number.isInteger(profile.resources.minVcpus) || !Number.isInteger(profile.resources.maxVcpus) || profile.resources.minVcpus < 1 || profile.resources.minVcpus > profile.resources.maxVcpus)) issues.push('resources vCPU bounds are invalid');
  if (profile.interfaces && (!Number.isInteger(profile.interfaces.max) || profile.interfaces.max < 0)) issues.push('interfaces.max is invalid');
  return issues;
}

module.exports = { validateWorkloadProfile };
