'use strict';
const crypto = require('node:crypto');

class ReservationRepository {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async withTransaction(work) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const value = await work(transaction(client)); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
}
function transaction(client) { return {
  async lockHost(hostId) { await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [hostId]); },
  async listActive(hostId) { const result = await client.query("SELECT * FROM sandlabx_resource_reservations WHERE state = 'ACTIVE' AND resource_key LIKE $1 FOR UPDATE", [`${hostId}|%`]); return result.rows.map(row); },
  async reserveMany(reservations) { for (const reservation of reservations) await client.query("INSERT INTO sandlabx_resource_reservations (id, instance_id, resource_type, resource_key, quantity, state) VALUES ($1, $2, $3, $4, $5, 'ACTIVE')", [crypto.randomUUID(), reservation.instanceId, reservation.type, reservation.key, reservation.quantity]); },
  async releaseInstance(instanceId) { const result = await client.query("UPDATE sandlabx_resource_reservations SET state = 'RELEASED' WHERE instance_id = $1 AND state = 'ACTIVE' RETURNING *", [instanceId]); return result.rows.map(row); },
}; }

class MemoryReservationRepository {
  constructor() { this.items = []; this.tail = Promise.resolve(); }
  async withTransaction(work) { const previous = this.tail; let done; this.tail = new Promise(resolve => { done = resolve; }); await previous; try { return await work(memoryTransaction(this.items)); } finally { done(); } }
}
function memoryTransaction(items) { return {
  async lockHost() {},
  async listActive(hostId) { return items.filter(item => item.state === 'ACTIVE' && item.key.startsWith(`${hostId}|`)).map(clone); },
  async reserveMany(reservations) { for (const reservation of reservations) { const duplicate = items.find(item => item.state === 'ACTIVE' && item.type === reservation.type && item.key === reservation.key); if (duplicate) throw codeError('Resource allocation is already reserved', 'ALLOCATION_CONFLICT'); items.push({ id: crypto.randomUUID(), ...clone(reservation), state: 'ACTIVE' }); } },
  async releaseInstance(instanceId) { const released = []; for (const item of items) if (item.instanceId === instanceId && item.state === 'ACTIVE') { item.state = 'RELEASED'; released.push(clone(item)); } return released; },
}; }
function row(value) { return { id: value.id, instanceId: value.instance_id, type: value.resource_type, key: value.resource_key, quantity: Number(value.quantity), state: value.state }; }
function clone(value) { return structuredClone(value); }
function codeError(message, code) { return Object.assign(new Error(message), { code }); }
module.exports = { ReservationRepository, MemoryReservationRepository };
