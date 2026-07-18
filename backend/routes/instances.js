'use strict';
const express = require('express'); const { actor, requireIdempotency, asyncRoute } = require('./_http');
function createInstanceRouter({ instanceService, operationService, capacityService, runtimeService }) {
  if (!instanceService) throw new TypeError('instanceService is required'); const router = express.Router();
  if (capacityService) router.get('/capacity/admission', asyncRoute(async (_req, res) => res.json({ success: true, capacity: await capacityService.get() })));
  router.post('/', asyncRoute(async (req, res) => res.status(202).json({ success: true, instance: await instanceService.create(actor(req), req.body) })));
  router.get('/:id', asyncRoute(async (req, res) => res.json({ success: true, instance: await instanceService.get(actor(req), req.params.id) })));
  if (runtimeService) {
    router.get('/:id/topology', asyncRoute(async (req, res) => res.json({ success: true, topology: await runtimeService.topology(actor(req), req.params.id) })));
    router.get('/:id/checkpoints', asyncRoute(async (req, res) => res.json({ success: true, checkpoints: await runtimeService.listCheckpoints(actor(req), req.params.id) })));
    router.post('/:id/checkpoints', asyncRoute(async (req, res) => { const key = requireIdempotency(req, res); if (!key) return; res.status(202).json({ success: true, operation: await runtimeService.createCheckpoint(actor(req), req.params.id, req.body || {}, key) }); }));
    router.post('/:id/checkpoints/:checkpointId/restore', asyncRoute(async (req, res) => { const key = requireIdempotency(req, res); if (!key) return; res.status(202).json({ success: true, operation: await runtimeService.restoreCheckpoint(actor(req), req.params.id, req.params.checkpointId, key) }); }));
    router.post('/:id/console-grants', asyncRoute(async (req, res) => res.status(201).json({ success: true, grant: await runtimeService.consoleGrant(actor(req), req.params.id, req.body?.nodeId, req.body?.transport) })));
    router.get('/:id/impact/:action', asyncRoute(async (req, res) => res.json({ success: true, impact: await runtimeService.impact(actor(req), req.params.id, req.params.action) })));
    router.post('/:id/destructive/:action', asyncRoute(async (req, res) => { const key = requireIdempotency(req, res); if (!key) return; res.status(202).json({ success: true, operation: await runtimeService.destructiveAction(actor(req), req.params.id, req.params.action, { ...req.body, requestId: req.requestId }, key) }); }));
    router.post('/:id/interfaces/:interfaceName/link-state', asyncRoute(async (req, res) => { const key = requireIdempotency(req, res); if (!key) return; res.status(202).json({ success: true, operation: await runtimeService.setLinkState(actor(req), req.params.id, req.params.interfaceName, Boolean(req.body?.up), key) }); }));
  }
  router.post('/:id/actions/:action', asyncRoute(async (req, res) => { const key = requireIdempotency(req, res); if (!key) return; if (!operationService) throw Object.assign(new Error('Operation service is unavailable'), { code: 'OPERATION_SERVICE_UNAVAILABLE' }); return res.status(202).json({ success: true, operation: await operationService.submit(actor(req), { instanceId: req.params.id, type: req.params.action.toUpperCase(), idempotencyKey: key, input: req.body || {} }) }); }));
  return router;
}
module.exports = { createInstanceRouter };
