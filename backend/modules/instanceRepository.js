const crypto = require('node:crypto');

class InstanceRepository {
  constructor({ pool }) { this.pool = pool; }

  async create(ownerId, capsuleVersionId, options = {}) {
    const version = await this.pool.query(`SELECT version.id FROM sandlabx_capsule_versions version JOIN sandlabx_capsules capsule ON capsule.id = version.capsule_id WHERE version.id = $1 AND capsule.owner_user_id = $2`, [capsuleVersionId, ownerId]);
    if (!version.rows.length) throw Object.assign(new Error('Capsule version not found'), { code: 'NOT_FOUND' });
    const id = crypto.randomUUID();
    const result = await this.pool.query(`INSERT INTO sandlabx_lab_instances (id, capsule_version_id, owner_user_id, name) VALUES ($1, $2, $3, $4) RETURNING *`, [id, capsuleVersionId, ownerId, options.name || `instance-${id.slice(0, 8)}`]);
    return rowToInstance(result.rows[0]);
  }

  async get(id, ownerId) {
    const result = await this.pool.query('SELECT * FROM sandlabx_lab_instances WHERE id = $1 AND owner_user_id = $2', [id, ownerId]);
    return result.rows.length ? rowToInstance(result.rows[0]) : null;
  }

  async list(ownerId) {
    const result = await this.pool.query('SELECT * FROM sandlabx_lab_instances WHERE owner_user_id = $1 ORDER BY created_at DESC', [ownerId]);
    return result.rows.map(rowToInstance);
  }

  async setState(id, ownerId, state, patch = {}) {
    const allowed = new Set(['state', 'desired_state', 'runner_id', 'failure_code', 'failure_detail', 'last_reconciled_at']);
    const entries = Object.entries(patch).filter(([key]) => allowed.has(key));
    const values = [state, id, ownerId];
    const setters = ['state = $1'];
    entries.forEach(([key, value], index) => { setters.push(`${key} = $${index + 4}`); values.push(value); });
    const result = await this.pool.query(`UPDATE sandlabx_lab_instances SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND owner_user_id = $3 RETURNING *`, values);
    if (!result.rows.length) throw Object.assign(new Error('Instance not found'), { code: 'NOT_FOUND' });
    return rowToInstance(result.rows[0]);
  }
}

class MemoryInstanceRepository {
  constructor({ capsules } = {}) { this.capsules = capsules; this.instances = new Map(); }

  async create(ownerId, capsuleVersionId, options = {}) {
    const version = await this.capsules.getVersion(capsuleVersionId, ownerId);
    if (!version) throw Object.assign(new Error('Capsule version not found'), { code: 'NOT_FOUND' });
    const instance = { id: crypto.randomUUID(), ownerId, capsuleVersionId, name: options.name || `instance-${crypto.randomUUID().slice(0, 8)}`, state: 'STOPPED', desiredState: 'STOPPED', failure: null, createdAt: new Date().toISOString() };
    this.instances.set(instance.id, instance);
    return structuredClone(instance);
  }

  async get(id, ownerId) {
    const instance = this.instances.get(id);
    return instance && instance.ownerId === ownerId ? structuredClone(instance) : null;
  }

  async setState(id, ownerId, state, patch = {}) {
    const instance = this.instances.get(id);
    if (!instance || instance.ownerId !== ownerId) throw Object.assign(new Error('Instance not found'), { code: 'NOT_FOUND' });
    Object.assign(instance, patch, { state });
    return structuredClone(instance);
  }
}

function rowToInstance(row) {
  return { id: row.id, capsuleVersionId: row.capsule_version_id, ownerId: row.owner_user_id, name: row.name, state: row.state, desiredState: row.desired_state, runnerId: row.runner_id, failureCode: row.failure_code, failureDetail: row.failure_detail, createdAt: row.created_at, updatedAt: row.updated_at };
}

module.exports = { InstanceRepository, MemoryInstanceRepository, rowToInstance };
