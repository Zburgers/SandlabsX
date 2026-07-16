const crypto = require('node:crypto');
const fs = require('node:fs').promises;
const path = require('node:path');

class CheckpointError extends Error {
  constructor(message, code = 'CHECKPOINT_ERROR') { super(message); this.name = 'CheckpointError'; this.code = code; }
}

class CheckpointService {
  constructor(options = {}) { this.root = path.resolve(options.root || path.join(process.cwd(), 'checkpoints')); this.overlayRoot = path.resolve(options.overlayRoot || this.root); this.metadataRoot = path.join(this.root, '.metadata'); }

  async create(instance, ownerId, nodes, options = {}) {
    this.assertOwner(instance, ownerId);
    if (instance.state !== 'STOPPED') throw new CheckpointError('Checkpoints require a stopped instance', 'INSTANCE_NOT_STOPPED');
    await fs.mkdir(this.metadataRoot, { recursive: true });
    const id = `checkpoint-${crypto.randomUUID()}`;
    const directory = path.join(this.root, id);
    const staging = path.join(this.root, `.staging-${id}`);
    await fs.mkdir(staging, { recursive: true });
    const manifest = { id, instanceId: instance.id, ownerId, name: options.name || id, state: 'CREATING', nodes: [] };
    try {
      for (const node of nodes) {
        const source = this.assertInside(this.overlayRoot, node.overlayPath);
        const target = path.join(staging, `${safe(node.nodeId)}.qcow2`);
        await fs.copyFile(source, target);
        const digest = await checksum(target);
        manifest.nodes.push({ nodeId: node.nodeId, sourcePath: source, checkpointPath: path.join(directory, path.basename(target)), sha256: digest, size: (await fs.stat(target)).size });
      }
      await fs.rename(staging, directory);
      manifest.state = 'READY';
      await atomicJson(path.join(this.metadataRoot, `${id}.json`), manifest);
      return manifest;
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true });
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async restore(instance, ownerId, id) {
    this.assertOwner(instance, ownerId);
    if (instance.state !== 'STOPPED') throw new CheckpointError('Restore requires a stopped instance', 'INSTANCE_NOT_STOPPED');
    const manifest = JSON.parse(await fs.readFile(path.join(this.metadataRoot, `${safe(id)}.json`), 'utf8').catch(() => { throw new CheckpointError('Checkpoint not found', 'NOT_FOUND'); }));
    if (manifest.ownerId !== ownerId || manifest.instanceId !== instance.id) throw new CheckpointError('Checkpoint not found', 'NOT_FOUND');
    for (const node of manifest.nodes) {
      const source = this.assertInside(this.root, node.checkpointPath);
      if (await checksum(source) !== node.sha256) throw new CheckpointError(`Checkpoint digest mismatch for ${node.nodeId}`, 'DIGEST_MISMATCH');
      const target = this.assertInside(this.overlayRoot, node.sourcePath);
      const staging = `${target}.restore-${crypto.randomUUID()}`;
      await fs.copyFile(source, staging);
      await fs.rename(staging, target);
    }
    manifest.state = 'RESTORED';
    await atomicJson(path.join(this.metadataRoot, `${safe(id)}.json`), manifest);
    return manifest;
  }

  async list(instance, ownerId) {
    this.assertOwner(instance, ownerId);
    const files = await fs.readdir(this.metadataRoot).catch(() => []);
    const checkpoints = [];
    for (const file of files.filter(name => name.endsWith('.json'))) {
      const item = JSON.parse(await fs.readFile(path.join(this.metadataRoot, file), 'utf8'));
      if (item.instanceId === instance.id && item.ownerId === ownerId) checkpoints.push(item);
    }
    return checkpoints.sort((a, b) => a.id.localeCompare(b.id));
  }

  assertOwner(instance, ownerId) { if (!instance || instance.ownerId !== ownerId) throw new CheckpointError('Instance not found', 'NOT_FOUND'); }
  assertInside(root, candidate) { const resolved = path.resolve(candidate); if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new CheckpointError('Checkpoint path escapes managed root', 'INVALID_PATH'); return resolved; }
}

function safe(value) { const result = String(value).replace(/[^a-zA-Z0-9_-]/g, ''); if (!result) throw new CheckpointError('Invalid checkpoint identifier', 'INVALID_ID'); return result; }
function checksum(file) { return new Promise((resolve, reject) => { const hash = crypto.createHash('sha256'); const stream = require('node:fs').createReadStream(file); stream.on('error', reject); stream.on('data', chunk => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex'))); }); }
async function atomicJson(file, value) { const temp = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); await fs.rename(temp, file); }

module.exports = { CheckpointError, CheckpointService };
