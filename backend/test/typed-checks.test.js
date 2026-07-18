'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { TypedCheckRunner } = require('../verification/typedChecks');

test('runs built-in readiness, topology, link, ping, service, serial, and artifact checks with bounded redacted evidence', async () => {
  const runner = new TypedCheckRunner({ maxEvidenceBytes: 80, timeoutMs: 40 });
  const result = await runner.runStage({ checks: [
    { id: 'ready', type: 'nodeReadiness', node: 'r1', expected: { state: 'RUNNING' }, score: 1, hint: 'Start r1.' },
    { id: 'topology', type: 'topology', expected: { nodes: 2, links: 1 }, score: 1 },
    { id: 'link', type: 'interfaceLink', target: 'r1:eth0', expected: { peer: 'r2:eth0', state: 'UP' }, score: 1 },
    { id: 'ping', type: 'ping', source: 'r1', destination: 'r2', expected: { reachable: true }, score: 1 },
    { id: 'service', type: 'servicePort', node: 'r2', port: 179, expected: { open: true }, score: 1 },
    { id: 'serial', type: 'serialOutput', node: 'r1', expected: { contains: 'FULL' }, score: 1 },
    { id: 'artifact', type: 'artifactContent', artifact: 'routing-log', expected: { contains: 'converged' }, score: 1 }
  ] }, {
    nodes: { r1: { state: 'RUNNING' }, r2: { state: 'RUNNING' } },
    topology: { nodes: ['r1', 'r2'], links: [{ a: 'r1:eth0', b: 'r2:eth0' }] },
    interfaces: { 'r1:eth0': { peer: 'r2:eth0', state: 'UP' } },
    ping: async () => ({ reachable: true, output: '64 bytes from r2 password=secret-value' }),
    servicePort: async () => ({ open: true, banner: 'bgp token: abc123' }),
    readSerial: async () => 'OSPF FULL authorization=Bearer very-secret',
    readArtifact: async () => 'routing converged '.repeat(20)
  });

  assert.equal(result.status, 'PASSED');
  assert.equal(result.score, 7);
  assert.equal(result.maximumScore, 7);
  assert.equal(result.results[0].hint, undefined);
  assert.match(JSON.stringify(result), /\[REDACTED\]/);
  assert.doesNotMatch(JSON.stringify(result), /secret-value|very-secret|abc123/);
  assert.ok(result.results.at(-1).evidence.output.length <= 80);
});

test('retries transient checks, reports hints for failures, and keeps timeout evidence bounded', async () => {
  let calls = 0;
  const runner = new TypedCheckRunner({ maxEvidenceBytes: 32, timeoutMs: 10 });
  const result = await runner.runStage({ checks: [
    { id: 'eventual-ping', type: 'ping', source: 'r1', destination: 'r2', retry: { attempts: 2, delayMs: 1 }, expected: { reachable: true }, score: 3 },
    { id: 'slow-serial', type: 'serialOutput', node: 'r1', timeoutMs: 5, expected: { contains: 'FULL' }, hint: 'Wait for adjacency.', score: 2 }
  ] }, {
    ping: async () => ({ reachable: ++calls === 2, output: 'transient' }),
    readSerial: async () => new Promise(resolve => setTimeout(() => resolve('FULL'), 30))
  });

  assert.equal(result.status, 'FAILED');
  assert.equal(result.score, 3);
  assert.equal(result.results[0].attempts, 2);
  assert.equal(result.results[1].status, 'ERROR');
  assert.equal(result.results[1].error.code, 'CHECK_TIMEOUT');
  assert.equal(result.results[1].hint, 'Wait for adjacency.');
});

test('rejects executable types and unknown check types', async () => {
  const runner = new TypedCheckRunner();
  await assert.rejects(runner.runStage({ checks: [{ id: 'host', type: 'command', command: 'id' }] }, {}), /Unsupported typed check/);
  await assert.rejects(runner.runStage({ checks: [{ id: 'unknown', type: 'unknown' }] }, {}), /Unsupported typed check/);
});
