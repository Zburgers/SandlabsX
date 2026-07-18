'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { validateWorkloadProfile } = require('../domain/workloadProfile');
test('workload profile validates capability bounds', () => { assert.deepEqual(validateWorkloadProfile({ id: 'qemu', version: '1', architecture: 'x86_64', machine: 'q35', console: 'serial', resources: { minVcpus: 1, maxVcpus: 2 }, interfaces: { max: 4 } }), []); assert.ok(validateWorkloadProfile({ id: 'qemu', resources: { minVcpus: 3, maxVcpus: 1 } }).length); });
