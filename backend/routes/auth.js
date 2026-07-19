'use strict';

const express = require('express');

function createAuthRouter({ authService, authenticate }) {
  if (!authService) throw new TypeError('authService is required');
  const router = express.Router();
  const handler = (action) => async (req, res, next) => {
    try {
      const result = await action(req);
      res.status(action.status || 200).json({ success: true, ...result });
    } catch (error) { next(error); }
  };
  router.post('/register', async (req, res, next) => {
    try { res.status(201).json({ success: true, ...await authService.register({ ...req.body, requestId: req.requestId }) }); } catch (error) { next(error); }
  });
  router.post('/login', handler((req) => authService.login({ ...req.body, requestId: req.requestId, ipAddress: req.ip })));
  router.get('/me', authenticate, handler((req) => authService.currentUser({ userId: req.auth?.sub })));
  router.post('/change-password', authenticate, handler((req) => authService.changePassword({ ...req.body, userId: req.auth?.sub, requestId: req.requestId })));
  return router;
}

module.exports = { createAuthRouter };
