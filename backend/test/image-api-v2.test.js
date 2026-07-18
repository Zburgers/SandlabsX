'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');

const { createImageRouter } = require('../routes/images');
const { ImageArtifactService } = require('../services/imageArtifactService');
const { MemoryImageArtifactRepository } = require('../repositories/imageArtifactRepository');
const { WorkloadProfileService } = require('../services/workloadProfileService');
const { MemoryWorkloadProfileRepository } = require('../repositories/workloadProfileRepository');

test('image v2 router resolves immutable versions and validates profiles through services', async t => {
  const imageArtifacts = new ImageArtifactService({ repository: new MemoryImageArtifactRepository() });
  const workloadProfiles = new WorkloadProfileService({ repository: new MemoryWorkloadProfileRepository() });
  const image = await imageArtifacts.publish({ name: 'router', digest: `sha256:${'a'.repeat(64)}`, format: 'qcow2', storagePath: '/images/router.qcow2', sizeBytes: 1, provenance: { kind: 'IMPORT', source: 'router.raw' } });
  const app = express();
  app.use(express.json());
  app.use('/api/images/v2', createImageRouter({ imageArtifacts, workloadProfiles }));
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/images/v2`;

  const imageResponse = await fetch(`${base}/versions/${image.id}`);
  assert.equal(imageResponse.status, 200);
  assert.equal((await imageResponse.json()).image.digest, image.digest);

  const profileResponse = await fetch(`${base}/profiles/validate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profile: { id: 'qemu', version: 'draft', architecture: 'x86_64', machine: 'q35', console: 'serial', resources: { minVcpus: 1, maxVcpus: 2 }, interfaces: { max: 2 } } }),
  });
  assert.equal(profileResponse.status, 200);
  assert.equal((await profileResponse.json()).valid, true);
});
