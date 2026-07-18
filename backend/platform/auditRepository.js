'use strict';
const { sanitize } = require('./observability');

class AuditRepository {
  constructor({ pool }) { this.pool = pool; }
  async append(event, client = this.pool) {
    const fields = ['actor_user_id', 'action', 'resource_type', 'resource_id', 'request_id', 'metadata'];
    const safeEvent = sanitize(event);
    const values = fields.map((field) => safeEvent[field] ?? null);
    const params = values.map((_, index) => `$${index + 1}`).join(', ');
    return client.query(
      `INSERT INTO sandlabx_audit_events (${fields.join(', ')}) VALUES (${params}) RETURNING *`,
      values,
    );
  }
}
module.exports = { AuditRepository };
