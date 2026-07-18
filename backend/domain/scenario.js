'use strict';
const { assertIdentifier } = require('./identifiers');

function normalizeScenario(document) {
  if (!document || document.kind !== 'LabScenario') throw new Error('kind must be LabScenario');
  const result = JSON.parse(JSON.stringify(document));
  result.apiVersion ||= 'sandlabx.io/v1alpha1';
  result.metadata ||= {};
  result.metadata.name = assertIdentifier(result.metadata.name, 'metadata.name');
  result.stages = [...(result.stages || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return result;
}

function validateScenario(document, capsuleVersion) {
  const issues = [];
  let scenario; try { scenario = normalizeScenario(document); } catch (error) { return [{ path: '$', message: error.message }]; }
  if (!scenario.spec?.capsuleVersion) issues.push({ path: 'spec.capsuleVersion', message: 'exact Capsule version is required' });
  const context = typeof capsuleVersion === 'object' ? capsuleVersion : { capsuleVersion };
  if (context.capsuleVersion && scenario.spec.capsuleVersion !== context.capsuleVersion) issues.push({ path: 'spec.capsuleVersion', message: 'does not match Capsule version' });
  for (const stage of scenario.stages) {
    if (!stage.id || !stage.checks) issues.push({ path: 'stages', message: 'stages require id and checks' });
    if (stage.checkpoint && !context.checkpoints?.includes(stage.checkpoint)) issues.push({ path: `stages.${stage.id}.checkpoint`, message: 'unknown checkpoint' });
    for (const check of stage.checks || []) {
      if (check.target) { const [node, iface] = check.target.split(':'); if (!context.nodes?.[node]?.includes(iface)) issues.push({ path: `stages.${stage.id}.checks.target`, message: 'unknown check target' }); }
      if (check.artifact && !context.artifacts?.includes(check.artifact)) issues.push({ path: `stages.${stage.id}.checks.artifact`, message: 'unknown artifact' });
    }
  }
  return issues;
}
module.exports = { normalizeScenario, validateScenario };
