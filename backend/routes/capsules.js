'use strict';
const express = require('express'); const { actor, requireIdempotency, asyncRoute } = require('./_http');
function createCapsuleRouter({ capsuleService }) {
  if (!capsuleService) throw new TypeError('capsuleService is required'); const router = express.Router();
  router.post('/', asyncRoute(async (req, res) => res.status(202).json({ success: true, capsule: await capsuleService.createDraft(actor(req), req.body) })));
  router.get('/:id', asyncRoute(async (req, res) => res.json({ success: true, capsule: await capsuleService.getDraft(actor(req), req.params.id) })));
  router.put('/:id', asyncRoute(async (req, res) => res.status(202).json({ success: true, capsule: await capsuleService.updateDraft(actor(req), req.params.id, Number(req.get('if-match') || req.body?.revision), req.body?.patch || req.body) })));
  router.post('/:id/validate', asyncRoute(async (req, res) => res.json({ success: true, ...(await capsuleService.validateDraft(actor(req), req.params.id, Boolean(req.body?.published))) })));
  router.post('/:id/private-revisions', asyncRoute(async (req, res) => { if (!requireIdempotency(req, res)) return; return res.status(202).json({ success: true, version: await capsuleService.createPrivateRevision(actor(req), req.params.id) }); }));
  router.post('/:id/publish', asyncRoute(async (req, res) => { if (!requireIdempotency(req, res)) return; return res.status(202).json({ success: true, version: await capsuleService.publish(actor(req), req.params.id) }); }));
  router.get('/:id/versions', asyncRoute(async (req, res) => res.json({ success: true, versions: await capsuleService.listVersions(actor(req), req.params.id) })));
  router.get('/versions/:versionId', asyncRoute(async (req, res) => res.json({ success: true, version: await capsuleService.getVersion(actor(req), req.params.versionId) })));
  router.post('/versions/:versionId/plan-preview', asyncRoute(async (req, res) => { if (!requireIdempotency(req, res)) return; return res.status(202).json({ success: true, preview: await capsuleService.requestPlanPreview(actor(req), req.params.versionId, { ...req.body, idempotencyKey: req.get('idempotency-key') }) }); }));
  return router;
}
module.exports = { createCapsuleRouter };
