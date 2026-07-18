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
const { createObservability } = require('./platform/observability');
const { AuditRepository } = require('./platform/auditRepository');
const { AuthService } = require('./services/authService');
const { ReservationRepository } = require('./repositories/reservationRepository');
const { AdmissionService } = require('./services/admissionService');
const { InstanceRuntimeService } = require('./services/instanceRuntimeService');
const { RuntimeApiService } = require('./services/runtimeApiService');

function createServices(pool) {
  const capsules = new CapsuleRepository({ pool }); const scenarios = new ScenarioRepository({ pool }); const assignments = new AssignmentRepository({ pool }); const instances = new InstanceRepository({ pool }); const operations = new OperationRepository({ pool });
  const imageArtifacts = new ImageArtifactService({ repository: new ImageArtifactRepository({ pool }), pipeline: new ImagePipeline({ root: process.env.CUSTOM_IMAGES_PATH, catalog: process.env.IMAGE_CATALOG_PATH }) });
  const workloadProfiles = new WorkloadProfileService({ repository: new WorkloadProfileRepository({ pool }) });
  const host = { id: process.env.RUNNER_ID || 'sandlabx-runner', architecture: process.env.HOST_ARCHITECTURE || 'x86_64', acceleration: ['kvm'], capabilities: ['kvm', 'tun'], capacity: { vcpus: Number(process.env.HOST_VCPUS || 8), memoryMiB: Number(process.env.HOST_MEMORY_MIB || 8192), storageGiB: Number(process.env.HOST_STORAGE_GIB || 100), consolePorts: Number(process.env.HOST_CONSOLE_PORTS || 64) } };
  const admission = new AdmissionService({ reservations: new ReservationRepository({ pool }) }); const imageRepository = new ImageArtifactRepository({ pool }); const profileRepository = new WorkloadProfileRepository({ pool });
  const instanceService = new InstanceRuntimeService({ instances, capsules, images: imageRepository, profiles: profileRepository, admission, host, overlaysRoot: process.env.OVERLAYS_PATH });
  const operationService = { async submit(actor, input) { await instanceService.get(actor, input.instanceId); const plan = await instanceService.planFor(actor, input.instanceId); return operations.create({ ownerId: actor.id, type: input.type, resourceType: 'instance', resourceId: input.instanceId, idempotencyKey: input.idempotencyKey, input: { ...(input.input || {}), plan } }); }, async get(actor, id) { const operation = await operations.get(id); if (!operation || (actor.role !== 'admin' && operation.ownerId !== actor.id)) throw Object.assign(new Error('Operation not found'), { code: 'NOT_FOUND' }); return operation; }, async cancel(actor, id) { await this.get(actor, id); return operations.requestCancel(id); } };
  const audit = new AuditRepository({ pool });
  const runtimeService = new RuntimeApiService({ pool, instances, operationService, audit, secret: process.env.RUNTIME_ACTION_SECRET || process.env.JWT_SECRET || 'change-this-runtime-secret' });
  return { authService: new AuthService({ pool, audit }), capsuleService: new CapsuleService({ repository: capsules }), scenarioService: new ScenarioService({ repository: scenarios, capsuleVersions: capsules }), assignmentService: new AssignmentService({ repository: assignments, capsuleVersions: capsules, scenarioVersions: scenarios }), instanceService, operationService, runtimeService, capacityService: { get: async () => ({ hostId: host.id, architecture: host.architecture, ...host.capacity }) }, eventService: { list: (actor, { after }) => operations.listEventsForOwner(actor.id, after) }, imageArtifacts, workloadProfiles, userRoles: { async get(id) { const result = await pool.query('SELECT role FROM sandlabx_users WHERE id=$1', [id]); return result.rows[0]?.role; } } };
}

async function main() {
  const database = createDatabase(); const metrics = createMetrics();
  const readiness = createReadinessService({ database, storage: createStorageCheck([process.env.VMS_PATH || path.join(process.cwd(), 'vms'), process.env.OVERLAYS_PATH || path.join(process.cwd(), 'overlays'), process.env.CHECKPOINTS_PATH || path.join(process.cwd(), 'checkpoints')]) });
  const observability = createObservability({ logger });
  const app = createApp({ services: createServices(database.pool), readiness, metrics, observability }); const server = app.listen(Number(process.env.PORT || 3001));
  const close = async () => { server.close(); await database.close(); };
  process.once('SIGTERM', close); process.once('SIGINT', close);
}
if (require.main === module) main().catch(error => { logger.error({ err: error }, 'Backend startup failed'); process.exitCode = 1; });
module.exports = { createServices };
