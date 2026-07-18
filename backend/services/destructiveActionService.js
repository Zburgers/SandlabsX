'use strict';
const crypto = require('node:crypto');
class DestructiveActionError extends Error { constructor(message, code = 'DESTRUCTIVE_ACTION_REJECTED') { super(message); this.name = 'DestructiveActionError'; this.code = code; } }
class DestructiveActionService {
  constructor({ secret, now = () => Date.now(), ttlMs = 60_000 }) { if (!secret) throw new TypeError('secret is required'); this.secret = secret; this.now = now; this.ttlMs = ttlMs; }
  createImpactToken(instance, action) { const claims = { instanceId: instance.id, name: instance.name, revision: instance.revision, action, exp: this.now() + this.ttlMs }; const body = Buffer.from(JSON.stringify(claims)).toString('base64url'); return `${body}.${this.sign(body)}`; }
  authorize({ instance, actorId, action, expectedName, expectedRevision, impactToken }) { if (!instance || instance.ownerId !== actorId) throw new DestructiveActionError('Instance not found', 'NOT_FOUND'); if (expectedName !== instance.name || expectedRevision !== instance.revision) throw new DestructiveActionError('Confirmation is stale', 'STALE_CONFIRMATION'); const claims = this.verify(impactToken); if (claims.instanceId !== instance.id || claims.name !== expectedName || claims.revision !== expectedRevision || claims.action !== action || claims.exp < this.now()) throw new DestructiveActionError('Impact token is stale', 'STALE_CONFIRMATION'); return instance; }
  sign(body) { return crypto.createHmac('sha256', this.secret).update(body).digest('base64url'); }
  verify(token) { const [body, signature] = String(token).split('.'); const expected = this.sign(body || ''); if (!body || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new DestructiveActionError('Invalid impact token', 'INVALID_TOKEN'); try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw new DestructiveActionError('Invalid impact token', 'INVALID_TOKEN'); } }
}
module.exports = { DestructiveActionService, DestructiveActionError };
