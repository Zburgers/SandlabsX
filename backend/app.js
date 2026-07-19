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
const { createAuthRouter } = require('./routes/auth');
const { createObservability } = require('./platform/observability');
const { requestContext } = require('./middleware/requestContext');

function httpLogObject(req, res, extra = {}) {
  return {
    request: { method: req.method, path: req.originalUrl || req.url, remoteAddress: req.socket?.remoteAddress },
    response: { statusCode: res.statusCode },
    responseTime: extra.responseTime,
  };
}

function createApp({ services, readiness, metrics, authenticate, observability } = {}) {
  if (!services) throw new TypeError('services are required');
  const authentication = authenticate || require('./middleware/auth');
  const telemetry = observability || createObservability({ logger });
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:2000'], credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'If-Match', 'X-Request-Id'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext({ observability: telemetry }));
  app.use(pinoHttp({
    logger: telemetry.logger,
    quietReqLogger: true,
    autoLogging: { ignore: (req) => req.url === '/api/health' || req.url === '/api/health/metrics' },
    customProps: (req) => ({ requestId: req.requestId }),
    customSuccessObject: (req, res, value) => httpLogObject(req, res, value),
    customErrorObject: (req, res, error, value) => ({ ...httpLogObject(req, res, value), error: { type: error.name, message: error.message } }),
  }));
  app.use('/api/health', createHealthRouter({ readiness, metrics }));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  if (services.authService) app.use('/api/auth', createAuthRouter({ authService: services.authService, authenticate: authentication }));
  app.use('/api', authentication);
  app.use('/api', async (req, _res, next) => {
    if (req.user?.role || !services.userRoles?.get) return next();
    try { req.user = { id: req.auth?.sub, role: await services.userRoles.get(req.auth?.sub) || 'student' }; next(); } catch (error) { next(error); }
  });
  app.use('/api/v2/capsules', createCapsuleRouter({ capsuleService: services.capsuleService }));
  app.use('/api/v2/scenarios', createScenarioRouter({ scenarioService: services.scenarioService }));
  app.use('/api/v2/assignments', createAssignmentRouter({ assignmentService: services.assignmentService }));
  app.use('/api/v2/instances', createInstanceRouter({ instanceService: services.instanceService, operationService: services.operationService, capacityService: services.capacityService, runtimeService: services.runtimeService }));
  app.use('/api/v2/operations', createOperationRouter({ operationService: services.operationService }));
  app.use('/api/v2/events', createEventRouter({ eventService: services.eventService }));
  app.use('/api/images/v2', createImageRouter({ imageArtifacts: services.imageArtifacts, workloadProfiles: services.workloadProfiles }));
  app.use('/api', (_req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'API route not found' }));
  app.use((error, req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) (req.log || telemetry.logger).error({ err: error, code: error.code }, 'API request failed');
    res.status(status).json({ success: false, code: error.code || 'INTERNAL_ERROR', error: status >= 500 ? 'Internal server error' : error.message });
  });
  return app;
}
module.exports = { createApp, httpLogObject };
