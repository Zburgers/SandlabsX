const express = require('express');
const path = require('node:path');
const { normalizeCapsule } = require('./capsuleSchema');
const { compilePlan } = require('./planCompiler');
const { safeName } = require('./imagePipeline');

function createCapsuleRouter(options) {
  const router = express.Router();
  const { capsules, instances, operations, imagePaths = {}, compilerOptions = {}, runner, verificationRunner, checkpointService } = options;
  const owner = req => req.auth?.sub || req.user?.id;
  const requireOwner = (req, res) => {
    const userId = owner(req);
    if (!userId) { res.status(401).json({ success: false, error: 'Authenticated user required', code: 'UNAUTHORIZED' }); return null; }
    return userId;
  };
  const sendError = (res, error) => {
    const statuses = { NOT_FOUND: 404, REVISION_CONFLICT: 409, INVALID_CAPSULE: 400, INSUFFICIENT_CAPACITY: 422, IMAGE_PATH_MISSING: 422, UNSUPPORTED_DRIVER: 422, RUNNER_UNAVAILABLE: 503 };
    res.status(statuses[error.code] || 500).json({ success: false, error: error.message, code: error.code || 'INTERNAL_ERROR', issues: error.issues, details: error.details });
  };
  const resolvePaths = document => Object.fromEntries(Object.entries(document.images).map(([id, image]) => [id, imagePaths[id] || path.join(process.env.CUSTOM_IMAGES_PATH || path.join(process.cwd(), 'images', 'custom'), `${safeName(image.name)}.qcow2`)]));

  router.post('/capsules', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { return res.status(201).json({ success: true, capsule: await capsules.createDraft(userId, req.body) }); } catch (error) { return sendError(res, error); }
  });
  router.get('/capsules', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { return res.json({ success: true, capsules: await capsules.list(userId) }); } catch (error) { return sendError(res, error); }
  });
  router.get('/capsules/:id', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { const capsule = await capsules.get(req.params.id, userId); return capsule ? res.json({ success: true, capsule }) : res.status(404).json({ success: false, code: 'NOT_FOUND' }); } catch (error) { return sendError(res, error); }
  });
  router.patch('/capsules/:id', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { return res.json({ success: true, capsule: await capsules.updateDraft(req.params.id, userId, Number(req.headers['if-match'] || req.body.revision), req.body.document || req.body) }); } catch (error) { return sendError(res, error); }
  });
  router.post('/capsules/:id/validate', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { const capsule = await capsules.get(req.params.id, userId); if (!capsule) return res.status(404).json({ success: false, code: 'NOT_FOUND' }); const document = normalizeCapsule(capsule.document, { requireDigests: Boolean(req.body?.requireDigests) }); return res.json({ success: true, valid: true, document }); } catch (error) { return sendError(res, error); }
  });
  router.post('/capsules/:id/publish', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { return res.status(201).json({ success: true, version: await capsules.publish(req.params.id, userId) }); } catch (error) { return sendError(res, error); }
  });
  router.get('/capsules/:id/versions', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { return res.json({ success: true, versions: await capsules.listVersions(req.params.id, userId) }); } catch (error) { return sendError(res, error); }
  });
  router.get('/capsule-versions/:id', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { const version = await capsules.getVersion(req.params.id, userId); return version ? res.json({ success: true, version }) : res.status(404).json({ success: false, code: 'NOT_FOUND' }); } catch (error) { return sendError(res, error); }
  });
  router.get('/capsule-versions/:id/export', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { const version = await capsules.getVersion(req.params.id, userId); if (!version) return res.status(404).json({ success: false, code: 'NOT_FOUND' }); res.type('application/json').send(`${JSON.stringify(version.document, null, 2)}\n`); } catch (error) { return sendError(res, error); }
  });
  router.post('/capsule-versions/:id/plan', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { const version = await capsules.getVersion(req.params.id, userId); if (!version) return res.status(404).json({ success: false, code: 'NOT_FOUND' }); return res.json({ success: true, plan: compilePlan(version.document, { ...compilerOptions, ...req.body, imagePaths: resolvePaths(version.document), instanceId: req.body.instanceId || `plan-${version.id.slice(0, 8)}` }) }); } catch (error) { return sendError(res, error); }
  });
  router.post('/instances', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { return res.status(201).json({ success: true, instance: await instances.create(userId, req.body.capsuleVersionId, { name: req.body.name }) }); } catch (error) { return sendError(res, error); }
  });
  router.get('/instances/:id', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { const instance = await instances.get(req.params.id, userId); return instance ? res.json({ success: true, instance }) : res.status(404).json({ success: false, code: 'NOT_FOUND' }); } catch (error) { return sendError(res, error); }
  });
  for (const action of ['start', 'stop', 'reset']) router.post(`/instances/:id/actions/${action}`, async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try {
      const instance = await instances.get(req.params.id, userId); if (!instance) return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      const operation = await operations.create({ ownerId: userId, type: action.toUpperCase(), resourceType: 'instance', resourceId: instance.id, idempotencyKey: req.headers['idempotency-key'] });
      await operations.appendEvent(operation.id, { type: 'QUEUED', action });
      if (runner) setImmediate(() => runner.run(operation, { instance, action, userId }).catch(async error => { await operations.update(operation.id, { state: 'FAILED', error: { code: error.code || 'RUNNER_ERROR', message: error.message } }); }));
      return res.status(202).json({ success: true, operation });
    } catch (error) { return sendError(res, error); }
  });
  router.get('/operations/:id', async (req, res) => { const userId = requireOwner(req, res); if (!userId) return; try { const operation = await operations.get(req.params.id, userId); return operation ? res.json({ success: true, operation }) : res.status(404).json({ success: false, code: 'NOT_FOUND' }); } catch (error) { return sendError(res, error); } });
  router.post('/operations/:id/cancel', async (req, res) => { const userId = requireOwner(req, res); if (!userId) return; try { const operation = operations.requestCancel ? await operations.requestCancel(req.params.id, userId) : await operations.update(req.params.id, { state: 'CANCELLING' }); return operation ? res.status(202).json({ success: true, operation }) : res.status(404).json({ success: false, code: 'NOT_FOUND' }); } catch (error) { return sendError(res, error); } });
  router.get('/operations/:id/events', async (req, res) => { const userId = requireOwner(req, res); if (!userId) return; try { const operation = await operations.get(req.params.id, userId); if (!operation) return res.status(404).json({ success: false, code: 'NOT_FOUND' }); return res.json({ success: true, events: await operations.listEvents(operation.id) }); } catch (error) { return sendError(res, error); } });
  router.post('/instances/:id/verifications', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try {
      if (!verificationRunner) throw Object.assign(new Error('Verification runner is unavailable'), { code: 'VERIFICATION_UNAVAILABLE' });
      const instance = await instances.get(req.params.id, userId); if (!instance) return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      const version = await capsules.getVersion(instance.capsuleVersionId, userId); if (!version) return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      const scenario = req.body.scenario || version.document.scenarios.find(item => item.id === req.body.scenarioId) || version.document.scenarios[0];
      if (!scenario) return res.status(400).json({ success: false, code: 'SCENARIO_REQUIRED' });
      const plan = compilePlan(version.document, { ...compilerOptions, imagePaths: resolvePaths(version.document), instanceId: instance.id });
      return res.status(201).json({ success: true, verification: await verificationRunner.run(scenario, { plan, artifactsRoot: req.body.artifactsRoot, readSerial: options.readSerial }) });
    } catch (error) { return sendError(res, error); }
  });
  router.post('/instances/:id/checkpoints', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { if (!checkpointService) throw Object.assign(new Error('Checkpoint service is unavailable'), { code: 'CHECKPOINT_UNAVAILABLE' }); const instance = await instances.get(req.params.id, userId); if (!instance) return res.status(404).json({ success: false, code: 'NOT_FOUND' }); return res.status(201).json({ success: true, checkpoint: await checkpointService.create(instance, userId, req.body.nodes || [], { name: req.body.name }) }); } catch (error) { return sendError(res, error); }
  });
  router.get('/instances/:id/checkpoints', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { if (!checkpointService) throw Object.assign(new Error('Checkpoint service is unavailable'), { code: 'CHECKPOINT_UNAVAILABLE' }); const instance = await instances.get(req.params.id, userId); if (!instance) return res.status(404).json({ success: false, code: 'NOT_FOUND' }); return res.json({ success: true, checkpoints: await checkpointService.list(instance, userId) }); } catch (error) { return sendError(res, error); }
  });
  router.post('/instances/:id/checkpoints/:checkpointId/restore', async (req, res) => {
    const userId = requireOwner(req, res); if (!userId) return;
    try { if (!checkpointService) throw Object.assign(new Error('Checkpoint service is unavailable'), { code: 'CHECKPOINT_UNAVAILABLE' }); const instance = await instances.get(req.params.id, userId); if (!instance) return res.status(404).json({ success: false, code: 'NOT_FOUND' }); return res.status(202).json({ success: true, checkpoint: await checkpointService.restore(instance, userId, req.params.checkpointId) }); } catch (error) { return sendError(res, error); }
  });
  return router;
}

module.exports = { createCapsuleRouter };
