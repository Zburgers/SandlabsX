#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const { ImagePipeline } = require('../modules/imagePipeline');
const { ImageArtifactService } = require('../services/imageArtifactService');
const { WorkloadProfileService } = require('../services/workloadProfileService');
const { ImageArtifactRepository } = require('../repositories/imageArtifactRepository');
const { WorkloadProfileRepository } = require('../repositories/workloadProfileRepository');
const { normalizeLabSpec, planInstall, validateLabSpec } = require('../modules/labSpec');
const { capsuleHash, normalizeCapsule, validateCapsule } = require('../modules/capsuleSchema');

function parse(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (argv[index + 1] && !argv[index + 1].startsWith('--')) flags[key] = argv[++index];
    else flags[key] = true;
  }
  return { positional, flags };
}

function bool(value) {
  return value === true || ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function help() {
  return `SandLabX developer CLI

Image commands:
  sandlabx image doctor
  sandlabx image list
  sandlabx image inspect <path>
  sandlabx image validate <path>
  sandlabx image import <path> [--name id] [--sha256 hash] [--overwrite]
  sandlabx image pull <catalog-id> [--name id] [--overwrite]
  sandlabx image compact <name>
  sandlabx image resize <name> <size>
  sandlabx image version-inspect <version-id>
  sandlabx image plan-install <iso> --name id [--disk-size 32G] [--cpus 2] [--memory 4096] [--vnc 5990] [--seed seed.iso]

Lab commands:
  sandlabx lab validate <file.json>
  sandlabx lab normalize <file.json> [output.json]

Capsule commands:
  sandlabx capsule validate <file.json> [--published]
  sandlabx capsule normalize <file.json> [output.json]

Workload profile commands:
  sandlabx profile list
  sandlabx profile inspect <version-id>
  sandlabx profile validate <file.json>

Global flags:
  --json
  --images-root <path>
  --catalog <path>
`;
}

async function imageCommand(action, args, flags) {
  const projectRoot = path.resolve(__dirname, '../..');
  const pipeline = new ImagePipeline({
    root: flags.imagesRoot,
    catalog: flags.catalog || path.join(projectRoot, 'images', 'catalog.json')
  });

  if (action === 'version-inspect') return versionServices().imageArtifacts.resolveImageVersion(required(args[0], 'image version id'));
  switch (action) {
    case 'doctor': return pipeline.doctor();
    case 'list': return pipeline.list();
    case 'inspect': return pipeline.inspect(required(args[0], 'image path'));
    case 'validate': return pipeline.validate(required(args[0], 'image path'), { allowBackingFile: bool(flags.allowBackingFile) });
    case 'import':
      return pipeline.import(required(args[0], 'image path'), {
        name: flags.name,
        displayName: flags.displayName,
        description: flags.description,
        tags: flags.tags ? String(flags.tags).split(',').filter(Boolean) : [],
        sha256: flags.sha256,
        overwrite: bool(flags.overwrite),
        compress: !bool(flags.noCompress)
      });
    case 'pull':
      return pipeline.pull(required(args[0], 'catalog id'), {
        name: flags.name,
        overwrite: bool(flags.overwrite),
        compress: !bool(flags.noCompress)
      });
    case 'compact': return pipeline.compact(required(args[0], 'image name'));
    case 'resize': return pipeline.resize(required(args[0], 'image name'), required(args[1], 'size'));
    case 'plan-install':
      return planInstall(required(args[0], 'ISO path'), {
        root: flags.imagesRoot,
        name: flags.name,
        diskSize: flags.diskSize,
        cpus: flags.cpus,
        memory: flags.memory,
        vnc: flags.vnc,
        seed: flags.seed
      });
    default: throw Object.assign(new Error(`Unknown image command: ${action || '(missing)'}`), { code: 'USAGE_ERROR' });
  }
}

async function profileCommand(action, args) {
  if (action === 'validate') {
    const profile = JSON.parse(await fs.readFile(required(args[0], 'workload profile JSON path'), 'utf8'));
    return new WorkloadProfileService({ repository: { createVersion() { throw new Error('not used'); }, getVersion() { throw new Error('not used'); } } }).validate(profile);
  }
  const profiles = versionServices().workloadProfiles;
  if (action === 'list') return profiles.listWorkloadProfileVersions();
  if (action === 'inspect') return profiles.resolveWorkloadProfileVersion(required(args[0], 'workload profile version id'));
  throw Object.assign(new Error(`Unknown profile command: ${action || '(missing)'}`), { code: 'USAGE_ERROR' });
}

function versionServices() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('DATABASE_URL is required for persisted image/profile version commands'), { code: 'VERSION_STORE_UNAVAILABLE' });
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return {
    imageArtifacts: new ImageArtifactService({ repository: new ImageArtifactRepository({ pool }) }),
    workloadProfiles: new WorkloadProfileService({ repository: new WorkloadProfileRepository({ pool }) }),
  };
}

async function labCommand(action, args) {
  const input = required(args[0], 'lab JSON path');
  const spec = JSON.parse(await fs.readFile(input, 'utf8'));
  if (action === 'validate') return validateLabSpec(spec);
  if (action === 'normalize') {
    const normalized = normalizeLabSpec(spec);
    if (args[1]) {
      await fs.writeFile(args[1], `${JSON.stringify(normalized, null, 2)}\n`, { flag: 'wx' });
      return { success: true, output: args[1] };
    }
    return normalized;
  }
  throw Object.assign(new Error(`Unknown lab command: ${action || '(missing)'}`), { code: 'USAGE_ERROR' });
}

async function capsuleCommand(action, args, flags) {
  const input = required(args[0], 'Capsule JSON path');
  const capsule = JSON.parse(await fs.readFile(input, 'utf8'));
  if (action === 'validate') {
    const result = validateCapsule(capsule, { requireDigests: bool(flags.published) });
    return { ...result, ...(result.valid ? { contentHash: capsuleHash(normalizeCapsule(capsule, { requireDigests: bool(flags.published) })) } : {}) };
  }
  if (action === 'normalize') {
    const normalized = normalizeCapsule(capsule, { requireDigests: bool(flags.published) });
    if (args[1]) { await fs.writeFile(args[1], `${JSON.stringify(normalized, null, 2)}\n`, { flag: 'wx' }); return { success: true, output: args[1], contentHash: capsuleHash(normalized) }; }
    return normalized;
  }
  throw Object.assign(new Error(`Unknown capsule command: ${action || '(missing)'}`), { code: 'USAGE_ERROR' });
}

function required(value, name) {
  if (!value) throw Object.assign(new Error(`Missing ${name}`), { code: 'USAGE_ERROR' });
  return value;
}

async function main() {
  const { positional, flags } = parse(process.argv.slice(2));
  const [group, action, ...args] = positional;
  if (!group || group === 'help' || flags.help) {
    process.stdout.write(help());
    return;
  }

  const result = group === 'image'
    ? await imageCommand(action, args, flags)
    : group === 'lab'
      ? await labCommand(action, args)
      : group === 'capsule'
        ? await capsuleCommand(action, args, flags)
        : group === 'profile'
          ? await profileCommand(action, args)
        : (() => { throw Object.assign(new Error(`Unknown command group: ${group}`), { code: 'USAGE_ERROR' }); })();

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result?.valid === false || result?.ok === false) process.exitCode = 2;
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ success: false, code: error.code || 'UNEXPECTED_ERROR', error: error.message, details: error.details, issues: error.issues }, null, 2)}\n`);
  if (error.code === 'USAGE_ERROR') process.stderr.write(`\n${help()}`);
  process.exitCode = 1;
});
