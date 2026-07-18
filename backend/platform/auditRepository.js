'use strict';
class AuditRepository {
  constructor({ pool, table = 'sandlabx_audit_events' }) { this.pool = pool; this.table = table; }
  async append(event, client = this.pool) { const fields = ['actor_user_id', 'action', 'resource_type', 'resource_id', 'request_id', 'metadata']; const values = fields.map((field) => event[field] ?? null); const params = values.map((_, index) => `$${index + 1}`).join(', '); return client.query(`INSERT INTO ${this.table} (${fields.join(', ')}) VALUES (${params}) RETURNING *`, values); }
}
module.exports = { AuditRepository };
