'use strict';
const assert = require('node:assert/strict'); const http = require('node:http'); const test = require('node:test'); const express = require('express');
const { createInstanceRouter } = require('../routes/instances'); const { createOperationRouter } = require('../routes/operations'); const { createEventRouter } = require('../routes/events');
function appWith(services) { const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = { id: 'student-a', role: 'student' }; next(); }); app.use('/api/v2/instances', createInstanceRouter({ instanceService: services.instances, operationService: services.operations })); app.use('/api/v2/operations', createOperationRouter({ operationService: services.operations })); app.use('/api/v2/events', createEventRouter({ eventService: services.events })); return app; }
test('instance lifecycle routes create durable intents and require idempotency keys', async t => {
  const calls = []; const services = { instances: { create: async (_actor, input) => ({ id: 'instance-1', ...input }) }, operations: { submit: async (_actor, input) => { calls.push(input); return { id: 'operation-1', state: 'QUEUED' }; }, get: async () => ({ id: 'operation-1' }), cancel: async () => ({ id: 'operation-1', state: 'CANCELLING' }) }, events: { list: async () => [] } };
  const server = http.createServer(appWith(services)).listen(0); t.after(() => server.close()); const base = `http://127.0.0.1:${server.address().port}/api/v2`;
  assert.equal((await fetch(`${base}/instances`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ capsuleVersionId: 'version-1' }) })).status, 202);
  assert.equal((await fetch(`${base}/instances/instance-1/actions/start`, { method: 'POST' })).status, 400);
  const operation = await fetch(`${base}/instances/instance-1/actions/start`, { method: 'POST', headers: { 'idempotency-key': 'start-1' } }); assert.equal(operation.status, 202); assert.equal(calls[0].type, 'START');
});
test('events route emits ordered resumable SSE events after cursor', async t => {
  const services = { instances: { create: async () => ({}) }, operations: { submit: async () => ({}) }, events: { list: async (_actor, { after }) => [{ cursor: after + 1, type: 'OPERATION_PROGRESS', payload: { progress: 50 } }] } };
  const server = http.createServer(appWith(services)).listen(0); t.after(() => server.close()); const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v2/events?after=7`); const body = await response.text(); assert.match(response.headers.get('content-type'), /^text\/event-stream/); assert.match(body, /id: 8/); assert.match(body, /event: OPERATION_PROGRESS/);
});
