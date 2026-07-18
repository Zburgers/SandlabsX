'use strict';
const crypto = require('node:crypto');
const clone = value => value === undefined ? undefined : structuredClone(value);
class AssignmentRepository {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async transaction(work) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async create(input, client = this.pool) { const result = await client.query('INSERT INTO sandlabx_assignments (id,owner_user_id,capsule_version_id,scenario_version_id,name) VALUES ($1,$2,$3,$4,$5) RETURNING *', [crypto.randomUUID(), input.ownerId, input.capsuleVersionId, input.scenarioVersionId, input.name]); return assignmentRow(result.rows[0]); }
  async addMember(assignmentId, userId, role = 'student', client = this.pool) { await client.query('INSERT INTO sandlabx_assignment_members (assignment_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT (assignment_id,user_id) DO UPDATE SET role=EXCLUDED.role', [assignmentId, userId, role]); }
  async get(id, client = this.pool) { const result = await client.query('SELECT * FROM sandlabx_assignments WHERE id=$1', [id]); return result.rows[0] && assignmentRow(result.rows[0]); }
  async memberRole(assignmentId, userId, client = this.pool) { const result = await client.query('SELECT role FROM sandlabx_assignment_members WHERE assignment_id=$1 AND user_id=$2', [assignmentId, userId]); return result.rows[0]?.role || null; }
}
class MemoryAssignmentRepository {
  constructor() { this.assignments = new Map(); this.members = new Map(); }
  async transaction(work) { const assignments = clone([...this.assignments]); const members = clone([...this.members]); try { return await work(this); } catch (error) { this.assignments = new Map(assignments); this.members = new Map(members); throw error; } }
  async create(input) { const item = { id: crypto.randomUUID(), ...clone(input), createdAt: new Date().toISOString() }; this.assignments.set(item.id, item); return clone(item); }
  async addMember(assignmentId, userId, role = 'student') { this.members.set(`${assignmentId}:${userId}`, role); }
  async get(id) { return clone(this.assignments.get(id)); }
  async memberRole(assignmentId, userId) { return this.members.get(`${assignmentId}:${userId}`) || null; }
}
function assignmentRow(row) { return { id: row.id, ownerId: row.owner_user_id, capsuleVersionId: row.capsule_version_id, scenarioVersionId: row.scenario_version_id, name: row.name, createdAt: row.created_at }; }
module.exports = { AssignmentRepository, MemoryAssignmentRepository };
