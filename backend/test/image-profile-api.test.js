'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createImageRouter } = require('../routes/images');

test('image and workload profile catalogues expose browser-safe immutable versions', async (t) => {
  const app = express();
  app.use('/api/images/v2', createImageRouter({
    imageArtifacts: {
      listImageVersions: async () => [{
        id: 'image-v1', name: 'debian', versionNumber: 3,
        digest: `sha256:${'a'.repeat(64)}`, format: 'qcow2',
        architecture: 'x86_64', sizeBytes: 1024, storagePath: '/private/images/debian.qcow2',
        provenance: { kind: 'IMPORT', source: 'https://secret.example/image' },
      }],
      resolveImageVersion: async () => ({ id: 'image-v1' }),
    },
    workloadProfiles: {
      listWorkloadProfileVersions: async () => [{
        id: 'profile-v1', name: 'router', versionNumber: 2, architecture: 'x86_64',
        resources: { minVcpus: 1, maxVcpus: 4, minMemoryMiB: 512, maxMemoryMiB: 4096 },
        interfaces: { max: 4, models: ['virtio-net-pci'] }, consoles: ['serial', 'vnc'],
      }],
      resolveWorkloadProfileVersion: async () => ({ id: 'profile-v1' }),
      validate: () => ({ valid: true, issues: [] }),
    },
  }));

  const server = http.createServer(app).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const [imagesResponse, profilesResponse] = await Promise.all([
    fetch(`${base}/api/images/v2/versions`),
    fetch(`${base}/api/images/v2/profiles/versions`),
  ]);
  const images = await imagesResponse.json();
  const profiles = await profilesResponse.json();

  assert.equal(imagesResponse.status, 200);
  assert.equal(profilesResponse.status, 200);
  assert.equal(images.images[0].id, 'image-v1');
  assert.equal(images.images[0].storagePath, undefined);
  assert.equal(images.images[0].provenance, undefined);
  assert.equal(profiles.profiles[0].resources.maxVcpus, 4);
});
