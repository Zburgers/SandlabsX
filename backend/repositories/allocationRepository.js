'use strict';
const crypto = require('node:crypto');
class AllocationRepository {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async reserve({ instanceId, interfaceId, type, key, ownership = {} }, client = this.pool) { const result = await client.query('INSERT INTO sandlabx_network_allocations (id,instance_id,interface_id,allocation_type,allocation_key,ownership) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [crypto.randomUUID(), instanceId, interfaceId, type, key, ownership]); return row(result.rows[0]); }
  async release(id, client = this.pool) { const result = await client.query('UPDATE sandlabx_network_allocations SET released_at=CURRENT_TIMESTAMP WHERE id=$1 AND released_at IS NULL RETURNING *', [id]); return result.rows[0] && row(result.rows[0]); }
}
class MemoryAllocationRepository { constructor() { this.items = new Map(); } async reserve(input) { const conflict = [...this.items.values()].find(value => value.type === input.type && value.key === input.key && !value.releasedAt); if (conflict) throw Object.assign(new Error('Allocation is already reserved'), { code: 'ALLOCATION_CONFLICT' }); const value = { id: crypto.randomUUID(), ...structuredClone(input), releasedAt: null }; this.items.set(value.id, value); return structuredClone(value); } async release(id) { const value = this.items.get(id); if (!value || value.releasedAt) return null; value.releasedAt = new Date().toISOString(); return structuredClone(value); } }
function row(value) { return { id: value.id, instanceId: value.instance_id, interfaceId: value.interface_id, type: value.allocation_type, key: value.allocation_key, ownership: value.ownership, releasedAt: value.released_at }; }
module.exports = { AllocationRepository, MemoryAllocationRepository };
