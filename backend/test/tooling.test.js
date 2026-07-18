const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const test = require('node:test');
const { ImageError, ImagePipeline, checksum, safeName } = require('../modules/imagePipeline');
const { normalizeLabSpec, planInstall, validateLabSpec } = require('../modules/labSpec');

function fakeRunner() {
  return async (_command, args) => {
    if (args[0] === '--version') return { stdout: 'qemu-img version 9.0.0\n', stderr: '' };
    if (args[0] === 'info') {
      const file = args.at(-1);
      const stat = await fs.stat(file);
      return {
        stdout: JSON.stringify({
          format: path.extname(file) === '.qcow2' ? 'qcow2' : 'raw',
          'virtual-size': stat.size,
          'actual-size': stat.size
        }),
        stderr: ''
      };
    }
    if (args[0] === 'check') return { stdout: '{}', stderr: '' };
    if (args[0] === 'convert') {
      await fs.copyFile(args.at(-2), args.at(-1));
      return { stdout: '', stderr: '' };
    }
    if (args[0] === 'resize') return { stdout: '', stderr: '' };
    throw new Error(`Unexpected command: ${args.join(' ')}`);
  };
}

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sandlabx-test-'));
  const source = path.join(directory, 'source.raw');
  await fs.writeFile(source, 'sandlabx fixture');
  const pipeline = new ImagePipeline({ root: path.join(directory, 'images'), runner: fakeRunner() });
  return { directory, source, pipeline };
}

function lab() {
  return {
    schemaVersion: 1,
    metadata: { name: 'Routing Lab', tags: ['routing', 'training', 'routing'] },
    nodes: {
      router1: { image: 'router', resources: { cpus: 1, memoryMiB: 2048 } },
      client1: { image: 'ubuntu-24.04', resources: { cpus: 2, memoryMiB: 4096 } }
    },
    links: [{
      a: { node: 'router1', interface: 'eth0' },
      b: { node: 'client1', interface: 'eth0' }
    }]
  };
}

test('safeName produces stable identifiers', () => {
  assert.equal(safeName(' Ubuntu 24.04 LTS.qcow2 '), 'ubuntu-24.04-lts');
  assert.equal(safeName('../../router image.vmdk'), 'router-image');
  assert.throws(() => safeName('...'), error => error instanceof ImageError && error.code === 'INVALID_NAME');
});

test('image import converts, validates, publishes, and writes a manifest', async t => {
  const item = await fixture();
  t.after(() => fs.rm(item.directory, { recursive: true, force: true }));
  const manifest = await item.pipeline.import(item.source, {
    name: 'Ubuntu Lab',
    displayName: 'Ubuntu Lab Image',
    tags: ['linux', 'student'],
    source: 'https://images.example.invalid/ubuntu.raw',
    provenance: { release: '24.04', checksumSource: 'https://images.example.invalid/SHA256SUMS' },
    license: { expression: 'GPL-2.0-or-later', source: 'https://images.example.invalid/LICENSE' }
  });

  const managed = item.pipeline.managedPath('ubuntu-lab');
  assert.equal(manifest.id, 'ubuntu-lab');
  assert.equal(manifest.sha256, await checksum(managed));
  assert.deepEqual(manifest.provenance, { release: '24.04', checksumSource: 'https://images.example.invalid/SHA256SUMS' });
  assert.deepEqual(manifest.license, { expression: 'GPL-2.0-or-later', source: 'https://images.example.invalid/LICENSE' });
  assert.equal((await item.pipeline.list())[0].name, 'Ubuntu Lab Image');
});

test('image import rejects checksum mismatches without publishing', async t => {
  const item = await fixture();
  t.after(() => fs.rm(item.directory, { recursive: true, force: true }));
  await assert.rejects(
    item.pipeline.import(item.source, { name: 'bad', sha256: '0'.repeat(64) }),
    error => error.code === 'CHECKSUM_MISMATCH'
  );
  await assert.rejects(fs.stat(item.pipeline.managedPath('bad')));
});

test('image locks reject concurrent operations', async t => {
  const item = await fixture();
  t.after(() => fs.rm(item.directory, { recursive: true, force: true }));
  await item.pipeline.init();
  await fs.writeFile(path.join(item.pipeline.root, '.locks', 'busy.lock'), 'locked');
  await assert.rejects(item.pipeline.import(item.source, { name: 'busy' }), error => error.code === 'LOCKED');
});

test('validation rejects external backing files', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sandlabx-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const image = path.join(directory, 'overlay.qcow2');
  await fs.writeFile(image, 'fixture');
  const runner = async (_command, args) => args[0] === 'info'
    ? { stdout: JSON.stringify({ format: 'qcow2', 'virtual-size': 7, 'backing-filename': '/tmp/base.qcow2' }) }
    : { stdout: '{}' };
  const result = await new ImagePipeline({ root: path.join(directory, 'managed'), runner }).validate(image);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /backing file/i);
});

test('lab validation catches unknown nodes and reused interfaces', () => {
  const spec = lab();
  spec.links.push({ a: { node: 'router1', interface: 'eth0' }, b: { node: 'missing', interface: 'eth1' } });
  const result = validateLabSpec(spec);
  assert.equal(result.valid, false);
  assert.match(result.issues.map(issue => issue.message).join(' '), /Unknown node/);
  assert.match(result.issues.map(issue => issue.message).join(' '), /already connected/);
});

test('lab normalization is deterministic', () => {
  const normalized = normalizeLabSpec(lab());
  assert.deepEqual(normalized.metadata.tags, ['routing', 'training']);
  assert.deepEqual(Object.keys(normalized.nodes), ['client1', 'router1']);
});

test('installer planner emits safe argument arrays', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sandlabx-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const iso = path.join(directory, 'debian.iso');
  await fs.writeFile(iso, 'iso');
  const plan = await planInstall(iso, { root: path.join(directory, 'images'), name: 'Debian Lab', diskSize: '24G', cpus: 4, memory: 8192, vnc: 5991 });
  assert.equal(plan.id, 'debian-lab');
  assert.equal(plan.createDisk.command, 'qemu-img');
  assert.ok(plan.launchInstaller.args.includes('0.0.0.0:91'));
});

test('CLI validates workload profiles through the profile service', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sandlabx-profile-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const profilePath = path.join(directory, 'profile.json');
  await fs.writeFile(profilePath, JSON.stringify({ id: 'qemu', version: 'draft', architecture: 'x86_64', machine: 'q35', console: 'serial', resources: { minVcpus: 1, maxVcpus: 2 }, interfaces: { max: 2 } }));
  const output = await new Promise((resolve, reject) => execFile(process.execPath, ['cli/sandlabx.js', 'profile', 'validate', profilePath], { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => error ? reject(Object.assign(error, { stderr })) : resolve(stdout)));
  assert.equal(JSON.parse(output).valid, true);
});

test('Compose runner disables the backend HTTP healthcheck it cannot serve', async () => {
  const compose = await fs.readFile(path.join(__dirname, '..', '..', 'docker-compose.yml'), 'utf8');
  const runner = compose.match(/\n  runner:\n([\s\S]*?)\n  frontend:/)?.[1] || '';
  assert.match(runner, /healthcheck:\s*\n\s+disable:\s+true/);
});
