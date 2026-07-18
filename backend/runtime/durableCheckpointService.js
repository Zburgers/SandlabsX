'use strict';
class DurableCheckpointService {
  constructor({ service, pool }) { if (!service || !pool) throw new TypeError('service and pool are required'); this.service = service; this.pool = pool; }
  async create(instance, ownerId, nodes, options = {}) { const manifest = await this.service.create(instance, ownerId, nodes, options); await this.pool.query(`INSERT INTO sandlabx_checkpoints (id,instance_id,owner_user_id,name,state,manifest) VALUES ($1,$2,$3,$4,'READY',$5) ON CONFLICT(id) DO UPDATE SET state='READY',manifest=EXCLUDED.manifest`, [manifest.id, instance.id, ownerId, options.name || manifest.id, manifest]); return manifest; }
  async restore(instance, ownerId, checkpoint) { const manifest = await this.service.restore(instance, ownerId, checkpoint); await this.pool.query("UPDATE sandlabx_checkpoints SET state='RESTORED',manifest=$2 WHERE id=$1", [manifest.id, manifest]); return manifest; }
}
module.exports = { DurableCheckpointService };
