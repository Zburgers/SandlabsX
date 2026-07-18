'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const path = require('node:path'); const { checkArchitecture } = require('../scripts/check-architecture');
const root = path.resolve(__dirname, '../..');
test('architecture checker inventories all required legacy runtime debt', () => {
  const report = checkArchitecture({ root, mode: 'inventory' });
  assert.ok(report.legacyImports.some((item) => item.includes('labManager')));
  assert.ok(report.legacyRoutes.some((item) => item.includes('server.js')));
  assert.ok(report.legacyTopology.some((item) => item.includes('labManager.js')));
  assert.ok(report.fixedNetwork.some((item) => item.includes('qemuManager.js')));
  assert.ok(report.shellExecution.some((item) => item.includes('qemuManager')));
  assert.ok(report.backupFiles.some((item) => item.includes('qemuManager.js.backup')));
  assert.ok(report.directConsole.length > 0);
  assert.throws(() => checkArchitecture({ root, mode: 'enforce' }), /legacyRoutes/);
});
