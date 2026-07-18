'use strict';
const assert = require('node:assert/strict'); const http = require('node:http'); const test = require('node:test'); const express = require('express');
const { createScenarioRouter } = require('../routes/scenarios'); const { createAssignmentRouter } = require('../routes/assignments');
test('Scenario and assignment routers pass the authenticated principal to services', async t => {
  const calls = []; const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.auth = { sub: 'instructor-a', role: 'instructor' }; next(); }); app.use('/api/v2/scenarios', createScenarioRouter({ scenarioService: { createDraft: async (actor, document) => { calls.push(actor); return { id: 'scenario-1', document }; }, publish: async () => ({ id: 'scenario-version-1' }) } })); app.use('/api/v2/assignments', createAssignmentRouter({ assignmentService: { createAssignment: async (actor, input) => { calls.push(actor); return { id: 'assignment-1', ...input }; }, canAccessAssignment: async () => true, grantInstructorObserver: async () => {} } })); const server = http.createServer(app).listen(0); t.after(() => server.close()); const base = `http://127.0.0.1:${server.address().port}/api/v2`;
  assert.equal((await fetch(`${base}/scenarios`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'LabScenario' }) })).status, 202);
  assert.equal((await fetch(`${base}/assignments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'week-one' }) })).status, 202);
  assert.deepEqual(calls.map(call => call.id), ['instructor-a', 'instructor-a']);
});
