'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createCapsuleRouter } = require('../routes/capsules');

function appWith(service, actor = { id: 'instructor-a', role: 'instructor' }) { const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = actor; next(); }); app.use('/api/v2/capsules', createCapsuleRouter({ capsuleService: service })); return app; }
test('Capsule v2 router delegates drafts and returns 202 for private runs and publication', async t => {
  const calls = []; const service = { createDraft: async (_actor, doc) => { calls.push(['create', doc]); return { id: 'draft-1', revision: 1 }; }, updateDraft: async () => ({ id: 'draft-1', revision: 2 }), validateDraft: async () => ({ valid: true, issues: [] }), createPrivateRevision: async () => ({ id: 'private-1' }), publish: async () => ({ id: 'version-1' }), getVersion: async () => ({ id: 'version-1' }), listVersions: async () => [], requestPlanPreview: async () => ({ operationId: 'preview-1' }) };
  const server = http.createServer(appWith(service)).listen(0); t.after(() => server.close()); const base = `http://127.0.0.1:${server.address().port}/api/v2/capsules`;
  const draft = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'LabCapsule' }) }); assert.equal(draft.status, 202); assert.equal((await draft.json()).capsule.id, 'draft-1');
  const revision = await fetch(`${base}/draft-1/private-revisions`, { method: 'POST', headers: { 'idempotency-key': 'private-1' } }); assert.equal(revision.status, 202);
  const publish = await fetch(`${base}/draft-1/publish`, { method: 'POST', headers: { 'idempotency-key': 'publish-1' } }); assert.equal(publish.status, 202);
  const preview = await fetch(`${base}/versions/version-1/plan-preview`, { method: 'POST', headers: { 'idempotency-key': 'preview-1', 'content-type': 'application/json' }, body: '{}' }); assert.equal(preview.status, 202); assert.equal(calls.length, 1);
});
test('Capsule v2 router maps stable safe errors and requires idempotency keys', async t => {
  const service = { createPrivateRevision: async () => { throw Object.assign(new Error('database password leaked'), { code: 'REVISION_CONFLICT' }); } };
  const server = http.createServer(appWith(service)).listen(0); t.after(() => server.close()); const base = `http://127.0.0.1:${server.address().port}/api/v2/capsules/draft-1/private-revisions`;
  assert.equal((await fetch(base, { method: 'POST' })).status, 400);
  const response = await fetch(base, { method: 'POST', headers: { 'idempotency-key': 'key-1' } }); assert.equal(response.status, 409); assert.equal((await response.json()).error, 'Capsule revision conflict');
});
