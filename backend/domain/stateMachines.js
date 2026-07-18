'use strict';

const transitions = {
  capsule: { DRAFT: ['VALIDATING'], VALIDATING: ['VALID', 'INVALID'], VALID: ['PUBLISHED'], PUBLISHED: ['ARCHIVED'], INVALID: ['DRAFT'], ARCHIVED: [] },
  instance: { CREATING: ['PROVISIONING', 'FAILED', 'DESTROYING'], PROVISIONING: ['STOPPED', 'FAILED', 'DESTROYING'], STOPPED: ['STARTING', 'RESETTING', 'DESTROYING'], STARTING: ['RUNNING', 'FAILED', 'STOPPING'], RUNNING: ['STOPPING', 'DEGRADED', 'DESTROYING'], STOPPING: ['STOPPED', 'FAILED'], DEGRADED: ['RECOVERING', 'FAILED', 'DESTROYING'], RECOVERING: ['RUNNING', 'FAILED'], RESETTING: ['STOPPED', 'FAILED'], FAILED: ['DESTROYING'], DESTROYING: ['DESTROYED'], DESTROYED: [] },
  operation: { QUEUED: ['PLANNING', 'CANCELLED'], PLANNING: ['RESERVED', 'FAILED', 'CANCELLING'], RESERVED: ['EXECUTING', 'FAILED', 'CANCELLING'], EXECUTING: ['SUCCEEDED', 'FAILED', 'CANCELLING'], CANCELLING: ['CANCELLED', 'FAILED'], SUCCEEDED: [], FAILED: [], CANCELLED: [] },
};

function assertStateTransition(machine, from, to) {
  if (!transitions[machine]?.[from]?.includes(to)) throw new Error(`Invalid ${machine} transition: ${from} -> ${to}`);
  return true;
}

module.exports = { transitions, assertStateTransition };
