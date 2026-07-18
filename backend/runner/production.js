'use strict';
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../platform/database');
const { OperationRepository } = require('../repositories/operationRepository');
const { ImageArtifactRepository } = require('../repositories/imageArtifactRepository');
const { ImageArtifactService } = require('../services/imageArtifactService');
const { CheckpointService } = require('../services/checkpointService');
const { ImagePipeline } = require('../modules/imagePipeline');
const { ProcessRunner } = require('../runtime/processRunner');
const { DiskService } = require('../runtime/diskService');
const { NetworkService } = require('../runtime/networkService');
const { QemuProcessService } = require('../runtime/qemuProcessService');
const { ConsoleService } = require('../runtime/consoleService');
const { PostgresConsoleRegistry } = require('../runtime/consoleRegistry');
const { createOperationHandlers } = require('./operationHandlers');
const { Runner } = require('./runner');
const logger = require('../logger');

function createRunnerRuntime({ pool, processRunner = new ProcessRunner(), env = process.env } = {}) {
  if (!pool) throw new TypeError('pool is required');
  const overlaysRoot = env.OVERLAYS_PATH || '/overlays'; const checkpointsRoot = env.CHECKPOINTS_PATH || '/checkpoints';
  const imagePipeline = new ImagePipeline({ root: env.CUSTOM_IMAGES_PATH || '/images/custom', catalog: env.IMAGE_CATALOG_PATH || '/images/catalog.json', runner: async (command, args, options) => { const result = await processRunner.run(command, args, options); if (result.code !== 0) throw Object.assign(new Error(`${command} failed`), { code: 'COMMAND_FAILED' }); return result; } });
  const disk = new DiskService({ root: overlaysRoot, runner: processRunner }); const network = new NetworkService({ runner: processRunner });
  const qemu = new QemuProcessService({ runner: processRunner, readiness: resource => processRunner.inspectProcess(resource.pid) });
  const consoleService = new ConsoleService({ registry: new PostgresConsoleRegistry({ pool }), secret: env.CONSOLE_TOKEN_SECRET });
  const checkpoints = new CheckpointService({ root: checkpointsRoot, overlayRoot: overlaysRoot });
  const capture = new ImageArtifactService({ repository: new ImageArtifactRepository({ pool }), pipeline: imagePipeline });
  const operations = new OperationRepository({ pool }); const id = env.RUNNER_ID || `${os.hostname()}:${process.pid}`;
  const handlers = createOperationHandlers({ disk, network, qemu, console: consoleService, checkpoints, capture });
  return { id, operations, handlers, runner: new Runner({ id, operations, handlers, leaseMs: Number(env.RUNNER_LEASE_MS || 30_000) }) };
}

async function main() { const database = createDatabase(); const runtime = createRunnerRuntime({ pool: database.pool }); let stopping = false; const stop = async () => { stopping = true; await database.close(); }; process.once('SIGTERM', stop); process.once('SIGINT', stop); while (!stopping) { try { const operation = await runtime.runner.runOnce(); if (!operation) await new Promise(resolve => setTimeout(resolve, Number(process.env.RUNNER_POLL_MS || 500))); } catch (error) { logger.error({ err: error, runnerId: runtime.id }, 'Runner operation failed'); } } }
if (require.main === module) main().catch(error => { logger.error({ err: error }, 'Runner startup failed'); process.exitCode = 1; });
module.exports = { createRunnerRuntime };
