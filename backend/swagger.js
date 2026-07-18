'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

module.exports = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'SandLabX Capsule API', version: '2.0.0', description: 'Canonical API for immutable Capsule versions and instance operation intents.' },
    servers: [{ url: 'http://localhost:3001', description: 'Development server' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths: {
      '/api/health': { get: { security: [], summary: 'Liveness and readiness summary', responses: { 200: { description: 'Healthy or degraded' }, 503: { description: 'Required dependency unavailable' } } } },
      '/api/health/ready': { get: { security: [], summary: 'Readiness summary', responses: { 200: { description: 'Ready or degraded' }, 503: { description: 'Not ready' } } } },
      '/api/v2/capsules': { post: { security: [{ bearerAuth: [] }], summary: 'Create a Capsule draft', responses: { 202: { description: 'Draft accepted' } } } },
      '/api/v2/instances': { post: { security: [{ bearerAuth: [] }], summary: 'Create an instance from an exact Capsule version', responses: { 202: { description: 'Instance accepted' } } } },
      '/api/v2/operations/{id}': { get: { security: [{ bearerAuth: [] }], summary: 'Read a durable operation', responses: { 200: { description: 'Operation state' } } } },
      '/api/v2/events': { get: { security: [{ bearerAuth: [] }], summary: 'Resume owner-scoped operation events', responses: { 200: { description: 'Server-sent events' } } } },
    },
  },
  apis: [],
});
