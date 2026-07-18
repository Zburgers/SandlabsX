'use strict';

const fs = require('node:fs/promises');

function createReadinessService({ database, runner, storage, guacamole, host } = {}) {
  return {
    async check() {
      const checks = {};
      checks.database = await requiredCheck(database, 'Database is unavailable', () => database?.healthcheck());
      checks.storage = await requiredCheck(storage, 'Runtime storage is unavailable', async () => {
        if (!storage) return { writable: true };
        const result = await storage.check();
        if (!result.writable) throw new Error('Storage is not writable');
        return result;
      });
      checks.runner = await optionalCheck(runner, 'Runner lease is stale', async () => ({ fresh: await runner.isFresh() }), value => value.fresh);
      checks.guacamole = await optionalCheck(guacamole, 'Guacamole is unavailable', () => guacamole.check(), Boolean);
      checks.host = await optionalCheck(host, 'KVM or TUN is unavailable', () => host.check(), value => value.kvm && value.tun);
      const requiredFailed = Object.values(checks).some(check => check.required && check.status === 'unhealthy');
      const optionalFailed = Object.values(checks).some(check => !check.required && check.status === 'degraded');
      return { status: requiredFailed ? 'unhealthy' : optionalFailed ? 'degraded' : 'healthy', checks, checkedAt: new Date().toISOString() };
    },
  };
}

async function requiredCheck(dependency, message, run) {
  if (!dependency) return { required: true, status: 'healthy', skipped: true };
  try { return { required: true, status: 'healthy', details: await run() }; }
  catch { return { required: true, status: 'unhealthy', message }; }
}
async function optionalCheck(dependency, message, run, healthy) {
  if (!dependency) return { required: false, status: 'healthy', skipped: true };
  try { const details = await run(); return { required: false, status: healthy(details) ? 'healthy' : 'degraded', details: typeof details === 'object' ? details : undefined, ...(healthy(details) ? {} : { message }) }; }
  catch { return { required: false, status: 'degraded', message }; }
}
function createStorageCheck(roots) {
  return { async check() { const stats = await Promise.all(roots.filter(Boolean).map(async root => { await fs.access(root, fs.constants.W_OK); const stat = await fs.statfs(root); return { root, writable: true, freeBytes: Number(stat.bavail) * Number(stat.bsize) }; })); return { writable: true, roots: stats }; } };
}
module.exports = { createReadinessService, createStorageCheck };
