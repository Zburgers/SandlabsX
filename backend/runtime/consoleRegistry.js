'use strict';
const crypto = require('node:crypto');
class PostgresConsoleRegistry {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async register(input) { const existing = await this.pool.query("SELECT id FROM sandlabx_console_endpoints WHERE instance_id=$1 AND ownership->>'nodeId'=$2 AND console_type=$3", [input.ownership.instanceId, input.ownership.nodeId, input.type]); if (existing.rows[0]) { await this.pool.query("UPDATE sandlabx_console_endpoints SET endpoint=$2,port=$3,state='ALLOCATED',ownership=$4 WHERE id=$1", [existing.rows[0].id, input.endpoint, input.port || null, input.ownership]); return { id: existing.rows[0].id }; } const result = await this.pool.query('INSERT INTO sandlabx_console_endpoints (id,instance_id,node_id,console_type,endpoint,port,ownership) VALUES ($1,$2,NULL,$3,$4,$5,$6) RETURNING id', [crypto.randomUUID(), input.ownership.instanceId, input.type, input.endpoint, input.port || null, input.ownership]); return { id: result.rows[0].id }; }
  async unregister(id) { await this.pool.query("UPDATE sandlabx_console_endpoints SET state='RELEASED' WHERE id=$1", [id]); }
}
module.exports = { PostgresConsoleRegistry };
