'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../../app');

function serviceStubs() {
  return {
    capsuleService: { createDraft: async () => ({ id: 'draft-1' }), getDraft: async () => ({ id: 'draft-1' }), updateDraft: async () => ({ id: 'draft-1' }), validateDraft: async () => ({ valid: true, issues: [] }), createPrivateRevision: async () => ({ id: 'private-1' }), publish: async () => ({ id: 'version-1' }), listVersions: async () => [], getVersion: async () => ({ id: 'version-1' }), requestPlanPreview: async () => ({}) },
    scenarioService: { createDraft: async () => ({ id: 'scenario-1' }), publish: async () => ({ id: 'scenario-version-1' }), getVersion: async () => ({ id: 'scenario-version-1' }) },
    assignmentService: { createAssignment: async () => ({ id: 'assignment-1' }), canAccessAssignment: async () => true, grantInstructorObserver: async () => {} },
    instanceService: { create: async () => ({ id: 'instance-1' }), get: async () => ({ id: 'instance-1' }) },
    operationService: { submit: async () => ({ id: 'operation-1' }), get: async () => ({ id: 'operation-1' }), cancel: async () => ({ id: 'operation-1' }) },
    eventService: { list: async () => [] },
    imageArtifacts: { resolveImageVersion: async () => ({ id: 'image-1' }) },
    workloadProfiles: { resolveWorkloadProfileVersion: async () => ({ id: 'profile-1' }), validate: () => ({ valid: true, issues: [] }) },
  };
}

test('production composition mounts only canonical Capsule route families', async (t) => {
  const app = createApp({ services: serviceStubs(), authenticate: (_req, _res, next) => { _req.user = { id: 'instructor-1', role: 'instructor' }; next(); }, readiness: { check: async () => ({ status: 'healthy', checks: {} }) } });
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const [health, capsule, legacy] = await Promise.all([
    fetch(`${base}/api/health`),
    fetch(`${base}/api/v2/capsules`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
    fetch(`${base}/api/labs`),
  ]);

  assert.equal(health.status, 200);
  assert.equal(capsule.status, 202);
  assert.equal(legacy.status, 404);
});
