'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const path = require('node:path'); const { checkArchitecture } = require('../scripts/check-architecture');
test('architecture checker inventories legacy runtime dependencies', () => { const report = checkArchitecture({ root: path.resolve(__dirname, '..'), mode: 'inventory' }); assert.ok(report.legacyImports.some((item) => item.includes('labManager'))); assert.ok(report.directConsole.length > 0); });
