'use strict';
class OwnershipError extends Error { constructor(message, code = 'OWNERSHIP_MISMATCH') { super(message); this.name = 'OwnershipError'; this.code = code; } }
function requireIdentity(value) { if (!value?.instanceId || !value?.nodeId) throw new OwnershipError('Instance and node ownership are required', 'OWNERSHIP_REQUIRED'); return { instanceId: String(value.instanceId), nodeId: String(value.nodeId) }; }
function sameOwnership(actual, expected) { return actual?.instanceId === expected?.instanceId && actual?.nodeId === expected?.nodeId; }
function assertOwned(resource, expected) { const identity = requireIdentity(expected); if (!sameOwnership(resource?.ownership, identity)) throw new OwnershipError('Resource ownership does not match'); return identity; }
function contained(root, candidate) { const resolvedRoot = require('node:path').resolve(root); const resolved = require('node:path').resolve(candidate); if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${require('node:path').sep}`)) throw new OwnershipError('Path escapes managed root', 'INVALID_PATH'); return resolved; }
module.exports = { OwnershipError, requireIdentity, assertOwned, contained };
