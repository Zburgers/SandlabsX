const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');

class ImageError extends Error {
  constructor(message, code = 'IMAGE_ERROR', details) {
    super(message);
    this.name = 'ImageError';
    this.code = code;
    this.details = details;
  }
}

function safeName(value) {
  const name = String(value || '').trim().toLowerCase().replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-._]+|[-._]+$/g, '');
  if (!name || name.length > 96) throw new ImageError('Image name must contain 1-96 safe characters', 'INVALID_NAME');
  return name;
}

function run(command, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', data => { stdout = (stdout + data).slice(-2000000); });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-2000000); });
    child.on('error', error => { clearTimeout(timer); reject(new ImageError(error.message, 'COMMAND_START_FAILED')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new ImageError(stderr.trim() || `${command} exited with ${code}`, 'COMMAND_FAILED', { command, args, code }));
    });
  });
}

async function checksum(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

class ImagePipeline {
  constructor(options = {}) {
    this.root = path.resolve(options.root || process.env.CUSTOM_IMAGES_PATH || path.join(process.cwd(), 'images', 'custom'));
    this.catalog = path.resolve(options.catalog || process.env.IMAGE_CATALOG_PATH || path.join(process.cwd(), 'images', 'catalog.json'));
    this.qemuImg = options.qemuImg || 'qemu-img';
    this.runner = options.runner || run;
  }

  async init() {
    await Promise.all(['.staging', '.locks', '.manifests'].map(dir => fsp.mkdir(path.join(this.root, dir), { recursive: true })));
  }

  managedPath(name) {
    return path.join(this.root, `${safeName(name)}.qcow2`);
  }

  async inspect(file) {
    const resolved = path.resolve(file);
    const stat = await fsp.stat(resolved).catch(() => null);
    if (!stat?.isFile()) throw new ImageError(`Image not found: ${resolved}`, 'NOT_FOUND');
    const { stdout } = await this.runner(this.qemuImg, ['info', '--output=json', resolved], { timeoutMs: 30000 });
    let info;
    try { info = JSON.parse(stdout); } catch { throw new ImageError('Invalid qemu-img JSON output', 'INVALID_QEMU_OUTPUT'); }
    return {
      path: resolved,
      format: info.format,
      fileSize: stat.size,
      virtualSize: info['virtual-size'] || null,
      actualSize: info['actual-size'] || stat.size,
      backingFile: info['backing-filename'] || null,
      encrypted: Boolean(info.encrypted),
      dirty: Boolean(info['dirty-flag'])
    };
  }

  async validate(file, { requireQcow2 = true, allowBackingFile = false } = {}) {
    const info = await this.inspect(file);
    const errors = [];
    if (requireQcow2 && info.format !== 'qcow2') errors.push(`Expected qcow2, found ${info.format}`);
    if (info.encrypted) errors.push('Encrypted managed images are not supported');
    if (info.backingFile && !allowBackingFile) errors.push('Managed base images cannot depend on a backing file');
    try { await this.runner(this.qemuImg, ['check', '--output=json', info.path]); }
    catch (error) { errors.push(error.message); }
    return { valid: errors.length === 0, errors, checkedAt: new Date().toISOString(), ...info };
  }

  async import(file, options = {}) {
    await this.init();
    const source = path.resolve(file);
    const sourceInfo = await this.inspect(source);
    if (sourceInfo.format === 'iso') throw new ImageError('ISO files require plan-install', 'ISO_REQUIRES_INSTALLER');
    const name = safeName(options.name || path.basename(source));
    const target = this.managedPath(name);
    const lock = path.join(this.root, '.locks', `${name}.lock`);
    const staged = path.join(this.root, '.staging', `${name}-${crypto.randomUUID()}.qcow2`);
    let handle;
    try { handle = await fsp.open(lock, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw new ImageError('Image operation already running', 'LOCKED'); throw error; }
    try {
      if (!options.overwrite && await fsp.stat(target).catch(() => null)) throw new ImageError(`Image already exists: ${name}`, 'EXISTS');
      if (options.sha256) {
        const actual = await checksum(source);
        if (actual.toLowerCase() !== String(options.sha256).toLowerCase()) throw new ImageError('SHA-256 mismatch', 'CHECKSUM_MISMATCH', { actual });
      }
      const args = ['convert'];
      if (options.compress !== false) args.push('-c');
      args.push('-p', '-f', sourceInfo.format, '-O', 'qcow2', source, staged);
      await this.runner(this.qemuImg, args, { timeoutMs: 21600000 });
      const result = await this.validate(staged);
      if (!result.valid) throw new ImageError(result.errors.join('; '), 'VALIDATION_FAILED');
      if (options.overwrite) await fsp.rm(target, { force: true });
      await fsp.rename(staged, target);
      const manifest = {
        schemaVersion: 1,
        id: name,
        name: options.displayName || name,
        description: options.description || '',
        tags: [...new Set(options.tags || [])],
        source: options.source || source,
        provenance: options.provenance ? structuredClone(options.provenance) : undefined,
        license: options.license ? structuredClone(options.license) : undefined,
        sourceFormat: sourceInfo.format,
        format: 'qcow2',
        sha256: await checksum(target),
        sizeBytes: (await fsp.stat(target)).size,
        virtualSizeBytes: result.virtualSize,
        importedAt: new Date().toISOString()
      };
      await this.writeManifest(name, manifest);
      return manifest;
    } finally {
      await fsp.rm(staged, { force: true }).catch(() => {});
      await handle?.close().catch(() => {});
      await fsp.rm(lock, { force: true }).catch(() => {});
    }
  }

  async list() {
    await this.init();
    const entries = await fsp.readdir(this.root, { withFileTypes: true });
    const images = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.qcow2')) continue;
      const id = entry.name.slice(0, -6);
      const manifest = await this.readManifest(id).catch(() => null);
      images.push({ id, name: manifest?.name || id, path: this.managedPath(id), sha256: manifest?.sha256 || null, tags: manifest?.tags || [] });
    }
    return images.sort((a, b) => a.name.localeCompare(b.name));
  }

  async compact(name) {
    const source = this.managedPath(name);
    const temp = `${source}.compact-${crypto.randomUUID()}`;
    try {
      await this.runner(this.qemuImg, ['convert', '-c', '-p', '-O', 'qcow2', source, temp], { timeoutMs: 21600000 });
      const result = await this.validate(temp);
      if (!result.valid) throw new ImageError(result.errors.join('; '), 'VALIDATION_FAILED');
      await fsp.rename(temp, source);
      const manifest = await this.readManifest(name).catch(() => ({ schemaVersion: 1, id: safeName(name), name: safeName(name) }));
      manifest.sha256 = await checksum(source);
      manifest.compactedAt = new Date().toISOString();
      await this.writeManifest(name, manifest);
      return manifest;
    } finally { await fsp.rm(temp, { force: true }).catch(() => {}); }
  }

  async resize(name, size) {
    if (!/^\d+(?:\.\d+)?[KMGTP]?$/i.test(String(size))) throw new ImageError('Invalid size; use values such as 20G', 'INVALID_SIZE');
    await this.runner(this.qemuImg, ['resize', this.managedPath(name), String(size)]);
    return this.validate(this.managedPath(name));
  }

  async pull(id, options = {}) {
    await this.init();
    const catalog = JSON.parse(await fsp.readFile(this.catalog, 'utf8'));
    const item = catalog.images?.find(entry => entry.id === id);
    if (!item) throw new ImageError(`Catalog image not found: ${id}`, 'CATALOG_NOT_FOUND');
    const extension = path.extname(new URL(item.url).pathname) || '.img';
    const download = path.join(this.root, '.staging', `${safeName(id)}-${crypto.randomUUID()}${extension}`);
    try {
      await this.download(item.url, download, item.maxBytes || 30 * 1024 ** 3);
      return await this.import(download, { ...options, name: options.name || item.id, displayName: item.name, description: item.description, tags: item.tags, sha256: item.sha256, source: item.url });
    } finally { await fsp.rm(download, { force: true }).catch(() => {}); }
  }

  async download(url, target, maxBytes, redirects = 5) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const request = client.get(parsed, { headers: { 'User-Agent': 'SandLabX/1.0' } }, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume();
          if (!response.headers.location || redirects <= 0) return reject(new ImageError('Download redirect limit exceeded', 'DOWNLOAD_FAILED'));
          return resolve(this.download(new URL(response.headers.location, parsed).toString(), target, maxBytes, redirects - 1));
        }
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new ImageError(`Download failed: HTTP ${response.statusCode}`, 'DOWNLOAD_FAILED'));
        let received = 0;
        const output = fs.createWriteStream(target, { flags: 'wx' });
        response.on('data', chunk => { received += chunk.length; if (received > maxBytes) response.destroy(new ImageError('Download exceeds size limit', 'DOWNLOAD_TOO_LARGE')); });
        response.on('error', reject);
        output.on('error', reject);
        output.on('finish', () => output.close(resolve));
        response.pipe(output);
      });
      request.setTimeout(30000, () => request.destroy(new ImageError('Download timed out', 'DOWNLOAD_TIMEOUT')));
      request.on('error', reject);
    });
  }

  async doctor() {
    const checks = [];
    for (const [name, command, args] of [['qemu-img', this.qemuImg, ['--version']], ['qemu-system', 'qemu-system-x86_64', ['--version']]]) {
      try { const result = await this.runner(command, args, { timeoutMs: 10000 }); checks.push({ name, ok: true, detail: (result.stdout || result.stderr).split('\n')[0] }); }
      catch (error) { checks.push({ name, ok: false, detail: error.message }); }
    }
    return { ok: checks.every(check => check.ok), checks };
  }

  async writeManifest(name, manifest) {
    const target = path.join(this.root, '.manifests', `${safeName(name)}.json`);
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(temp, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await fsp.rename(temp, target);
  }

  async readManifest(name) {
    return JSON.parse(await fsp.readFile(path.join(this.root, '.manifests', `${safeName(name)}.json`), 'utf8'));
  }
}

module.exports = { ImageError, ImagePipeline, checksum, run, safeName };
