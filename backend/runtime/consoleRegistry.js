'use strict';
const crypto = require('node:crypto');
class PostgresConsoleRegistry {
  constructor({ pool }) { if (!pool) throw new TypeError('pool is required'); this.pool = pool; }
  async register(input) { const result = await this.pool.query(`INSERT INTO sandlabx_console_endpoints (id,instance_id,node_id,console_type,endpoint,port,ownership) VALUES ($1,$2,NULL,$3,$4,$5,$6) ON CONFLICT(instance_id,node_id,console_type) DO UPDATE SET endpoint=EXCLUDED.endpoint,port=EXCLUDED.port,state='ALLOCATED',ownership=EXCLUDED.ownership RETURNING id`, [crypto.randomUUID(), input.ownership.instanceId, input.type, input.endpoint, input.port || null, input.ownership]); return { id: result.rows[0].id }; }
  async unregister(id) { await this.pool.query("UPDATE sandlabx_console_endpoints SET state='RELEASED' WHERE id=$1", [id]); }
}
module.exports = { PostgresConsoleRegistry };
