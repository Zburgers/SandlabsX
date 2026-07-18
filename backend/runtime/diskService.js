'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { OwnershipError, requireIdentity, assertOwned, contained } = require('./ownership');
class DiskService {
  constructor({ root, runner }) { if (!root || !runner?.run) throw new TypeError('root and runner are required'); this.root = path.resolve(root); this.runner = runner; }
  async createOverlay(input) { const ownership = requireIdentity(input); const output = contained(this.root, input.overlayPath); const baseImage = path.resolve(input.baseImage); await fs.access(baseImage); await fs.mkdir(path.dirname(output), { recursive: true }); const staging = path.join(path.dirname(output), `.${path.basename(output)}.${crypto.randomUUID()}.staging`); try { const result = await this.runner.run('qemu-img', ['create', '-f', 'qcow2', '-F', 'qcow2', '-b', baseImage, staging], { correlationId: input.correlationId }); if (result.code !== 0) throw new Error('qemu-img failed to create overlay'); await fs.rename(staging, output); return { path: output, ownership }; } catch (error) { await fs.rm(staging, { force: true }).catch(() => {}); throw error; } }
  async observe(resource) { const target = contained(this.root, resource.path); try { return { ...resource, exists: true, size: (await fs.stat(target)).size }; } catch (error) { if (error.code === 'ENOENT') return { ...resource, exists: false }; throw error; } }
  async removeOverlay(resource, ownership) { assertOwned(resource, ownership); await fs.rm(contained(this.root, resource.path), { force: true }); }
}
module.exports = { DiskService, OwnershipError };
