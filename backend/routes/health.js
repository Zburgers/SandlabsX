'use strict';

const express = require('express');

function createHealthRouter({ readiness, metrics }) {
  if (!readiness?.check) throw new TypeError('readiness.check is required');
  const router = express.Router();
  router.get('/', async (_req, res, next) => { try { const result = await readiness.check(); res.status(result.status === 'unhealthy' ? 503 : 200).json(result); } catch (error) { next(error); } });
  router.get('/ready', async (_req, res, next) => { try { const result = await readiness.check(); res.status(result.status === 'unhealthy' ? 503 : 200).json(result); } catch (error) { next(error); } });
  router.get('/metrics', (_req, res) => res.json({ metrics: metrics?.snapshot?.() || {} }));
  return router;
}
module.exports = { createHealthRouter };
