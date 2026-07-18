'use strict';

const path = require('node:path');
const { createDatabase } = require('./platform/database');
const { createMetrics } = require('./platform/metrics');
const { createReadinessService, createStorageCheck } = require('./platform/readiness');
const { CapsuleRepository } = require('./repositories/capsuleRepository');
const { ScenarioRepository } = require('./repositories/scenarioRepository');
const { AssignmentRepository } = require('./repositories/assignmentRepository');
const { InstanceRepository } = require('./repositories/instanceRepository');
const { OperationRepository } = require('./repositories/operationRepository');
const { ImageArtifactRepository } = require('./repositories/imageArtifactRepository');
const { WorkloadProfileRepository } = require('./repositories/workloadProfileRepository');
const { CapsuleService } = require('./services/capsuleService');
const { ScenarioService } = require('./services/scenarioService');
const { AssignmentService } = require('./services/assignmentService');
const { ImageArtifactService } = require('./services/imageArtifactService');
const { WorkloadProfileService } = require('./services/workloadProfileService');
const { ImagePipeline } = require('./modules/imagePipeline');
const { createApp } = require('./app');
const logger = require('./logger');

function createServices(pool) {
  const capsules = new CapsuleRepository({ pool }); const scenarios = new ScenarioRepository({ pool }); const assignments = new AssignmentRepository({ pool }); const instances = new InstanceRepository({ pool }); const operations = new OperationRepository({ pool });
  const imageArtifacts = new ImageArtifactService({ repository: new ImageArtifactRepository({ pool }), pipeline: new ImagePipeline({ root: process.env.CUSTOM_IMAGES_PATH, catalog: process.env.IMAGE_CATALOG_PATH }) });
  const workloadProfiles = new WorkloadProfileService({ repository: new WorkloadProfileRepository({ pool }) });
  const instanceService = { async create(actor, input) { const version = await capsules.getVersion(input.capsuleVersionId); if (!version) throw Object.assign(new Error('Capsule version not found'), { code: 'NOT_FOUND' }); return instances.create({ ownerId: actor.id, capsuleVersionId: version.id, name: input.name }); }, async get(actor, id) { const instance = await instances.get(id); if (!instance || (actor.role !== 'admin' && instance.ownerId !== actor.id)) throw Object.assign(new Error('Instance not found'), { code: 'NOT_FOUND' }); return instance; } };
  const operationService = { async submit(actor, input) { await instanceService.get(actor, input.instanceId); return operations.create({ ownerId: actor.id, type: input.type, resourceType: 'instance', resourceId: input.instanceId, idempotencyKey: input.idempotencyKey }); }, async get(actor, id) { const operation = await operations.get(id); if (!operation || (actor.role !== 'admin' && operation.ownerId !== actor.id)) throw Object.assign(new Error('Operation not found'), { code: 'NOT_FOUND' }); return operation; }, async cancel(actor, id) { await this.get(actor, id); return operations.requestCancel(id); } };
  return { capsuleService: new CapsuleService({ repository: capsules }), scenarioService: new ScenarioService({ repository: scenarios, capsuleVersions: capsules }), assignmentService: new AssignmentService({ repository: assignments, capsuleVersions: capsules, scenarioVersions: scenarios }), instanceService, operationService, eventService: { list: (actor, { after }) => operations.listEventsForOwner(actor.id, after) }, imageArtifacts, workloadProfiles, userRoles: { async get(id) { const result = await pool.query('SELECT role FROM sandlabx_users WHERE id=$1', [id]); return result.rows[0]?.role; } } };
}

async function main() {
  const database = createDatabase(); const metrics = createMetrics();
  const readiness = createReadinessService({ database, storage: createStorageCheck([process.env.VMS_PATH || path.join(process.cwd(), 'vms'), process.env.OVERLAYS_PATH || path.join(process.cwd(), 'overlays'), process.env.CHECKPOINTS_PATH || path.join(process.cwd(), 'checkpoints')]) });
  const app = createApp({ services: createServices(database.pool), readiness, metrics }); const server = app.listen(Number(process.env.PORT || 3001));
  const close = async () => { server.close(); await database.close(); };
  process.once('SIGTERM', close); process.once('SIGINT', close);
}
if (require.main === module) main().catch(error => { logger.error({ err: error }, 'Backend startup failed'); process.exitCode = 1; });
module.exports = { createServices };
