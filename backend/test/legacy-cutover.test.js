'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const forbiddenFiles = [
  'modules/labManager.js', 'modules/nodeManager.js', 'modules/nodeManagerPostgres.js',
  'modules/qemuManager.js', 'modules/qemuManager.js.backup', 'modules/capsuleRouter.js',
  'modules/capsuleRepository.js', 'modules/instanceRepository.js', 'modules/operationRepository.js',
  'modules/networkAllocator.js', 'modules/localRunner.js',
];

test('legacy runtime modules are absent after the Capsule cutover', () => {
  for (const file of forbiddenFiles) assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must be deleted`);
});

test('architecture enforcement is clean with no cutover allowlist', () => {
  const { checkArchitecture } = require('../scripts/check-architecture');
  const report = checkArchitecture({ root: path.resolve(root, '..'), mode: 'inventory' });
  assert.deepEqual(report, Object.fromEntries(Object.keys(report).map((key) => [key, []])));
});
