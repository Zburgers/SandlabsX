'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { checkArchitecture } = require('../scripts/check-architecture');

test('architecture enforcement rejects no legacy Capsule cutover debt', () => {
  const report = checkArchitecture({ root: path.resolve(__dirname, '../..'), mode: 'inventory' });
  assert.deepEqual(report, Object.fromEntries(Object.keys(report).map(key => [key, []])));
});
