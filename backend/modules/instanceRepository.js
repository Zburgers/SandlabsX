const crypto = require('node:crypto');

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

module.exports = { MemoryInstanceRepository };
