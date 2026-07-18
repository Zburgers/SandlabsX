'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { ReconciliationService } = require('../runner/reconciliationService');

test('ReconciliationService adopts matching processes, detects PID reuse, and only cleans orphaned owned TAPs', async () => {
  const deleted = []; const qemu = { observe: async resource => resource.pid === 9 ? { command: resource.identity.command, args: resource.identity.args } : { command: 'other', args: [] } }; const network = { deleteTap: async resource => deleted.push(resource.name) };
  const service = new ReconciliationService({ qemu, network });
  const process = { pid: 9, ownership: { instanceId: 'instance-a', nodeId: 'node-a' }, identity: { command: 'qemu-system-x86_64', args: ['-name', 'sandlabx-instance-a-node-a'] } };
  assert.equal((await service.reconcileProcess(process)).classification, 'ADOPTED');
  assert.equal((await service.reconcileProcess({ ...process, pid: 10 })).classification, 'PID_REUSED');
  await service.cleanupOrphanTap({ name: 'tap-owned', ownership: { instanceId: 'instance-a', nodeId: 'node-a' } }, { instanceId: 'instance-a', nodeId: 'node-a' });
  await assert.rejects(service.cleanupOrphanTap({ name: 'tap-unknown', ownership: { instanceId: 'other', nodeId: 'node-a' } }, { instanceId: 'instance-a', nodeId: 'node-a' }));
  assert.deepEqual(deleted, ['tap-owned']);
});
