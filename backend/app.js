'use strict';

const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');
const logger = require('./logger');
const swaggerSpec = require('./swagger');
const { createHealthRouter } = require('./routes/health');
const { createCapsuleRouter } = require('./routes/capsules');
const { createScenarioRouter } = require('./routes/scenarios');
const { createAssignmentRouter } = require('./routes/assignments');
const { createInstanceRouter } = require('./routes/instances');
const { createOperationRouter } = require('./routes/operations');
const { createEventRouter } = require('./routes/events');
const { createImageRouter } = require('./routes/images');

function createApp({ services, readiness, metrics, authenticate } = {}) {
  if (!services) throw new TypeError('services are required');
  const authentication = authenticate || require('./middleware/auth');
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:2000'], credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'If-Match', 'X-Request-Id'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));
  app.use('/api/health', createHealthRouter({ readiness, metrics }));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api', authentication);
  app.use('/api', async (req, _res, next) => {
    if (req.user?.role || !services.userRoles?.get) return next();
    try { req.user = { id: req.auth?.sub, role: await services.userRoles.get(req.auth?.sub) || 'student' }; next(); } catch (error) { next(error); }
  });
  app.use('/api/v2/capsules', createCapsuleRouter({ capsuleService: services.capsuleService }));
  app.use('/api/v2/scenarios', createScenarioRouter({ scenarioService: services.scenarioService }));
  app.use('/api/v2/assignments', createAssignmentRouter({ assignmentService: services.assignmentService }));
  app.use('/api/v2/instances', createInstanceRouter({ instanceService: services.instanceService, operationService: services.operationService }));
  app.use('/api/v2/operations', createOperationRouter({ operationService: services.operationService }));
  app.use('/api/v2/events', createEventRouter({ eventService: services.eventService }));
  app.use('/api/images/v2', createImageRouter({ imageArtifacts: services.imageArtifacts, workloadProfiles: services.workloadProfiles }));
  app.use((error, _req, res, _next) => { logger.error({ err: error }, 'Unhandled API error'); res.status(error.status || 500).json({ success: false, code: error.code || 'INTERNAL_ERROR', error: 'Internal server error' }); });
  return app;
}
module.exports = { createApp };
