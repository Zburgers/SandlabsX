'use strict';
const express = require('express'); const { actor, requireIdempotency, asyncRoute } = require('./_http');
function createOperationRouter({ operationService }) { if (!operationService) throw new TypeError('operationService is required'); const router = express.Router(); router.get('/:id', asyncRoute(async (req, res) => res.json({ success: true, operation: await operationService.get(actor(req), req.params.id) }))); router.post('/:id/cancel', asyncRoute(async (req, res) => { if (!requireIdempotency(req, res)) return; return res.status(202).json({ success: true, operation: await operationService.cancel(actor(req), req.params.id, req.get('idempotency-key')) }); })); return router; }
module.exports = { createOperationRouter };
