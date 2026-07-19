'use strict';

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

class AuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash || '').split(':');
  if (!salt || !originalHash || !/^[a-f0-9]+$/i.test(originalHash)) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(originalHash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

class AuthService {
  constructor({ pool, audit, jwtSecret = process.env.JWT_SECRET }) {
    if (!pool) throw new TypeError('pool is required');
    if (!jwtSecret) throw new TypeError('JWT_SECRET is required');
    this.pool = pool;
    this.audit = audit;
    this.jwtSecret = jwtSecret;
  }

  tokenFor(user) {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role, authVersion: user.auth_version || 0 },
      this.jwtSecret,
      { expiresIn: '24h' },
    );
  }

  async auditEvent(event, client) {
    if (this.audit) await this.audit.append(event, client);
  }

  async register({ email, password, requestId }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail.includes('@')) throw new AuthError('VALIDATION_ERROR', 'Valid email required');
    if (typeof password !== 'string' || password.length < 8) throw new AuthError('VALIDATION_ERROR', 'Password must be at least 8 characters');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO sandlabx_users (email, password_hash, role)
         VALUES ($1, $2, 'student')
         RETURNING id, email, role, auth_version, must_change_password`,
        [normalizedEmail, hashPassword(password)],
      );
      const user = result.rows[0];
      await this.auditEvent({ actor_user_id: user.id, action: 'auth.register', resource_type: 'user', resource_id: user.id, request_id: requestId, metadata: {} }, client);
      await client.query('COMMIT');
      return { token: this.tokenFor(user), user: publicUser(user) };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      if (error.code === '23505') throw new AuthError('EMAIL_EXISTS', 'Email already registered', 409);
      throw error;
    } finally {
      client.release();
    }
  }

  async login({ email, password, requestId, ipAddress }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || typeof password !== 'string') throw new AuthError('VALIDATION_ERROR', 'Email and password required');
    const result = await this.pool.query(
      `SELECT id, email, password_hash, role, is_active, auth_version, must_change_password
       FROM sandlabx_users WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail],
    );
    const user = result.rows[0];
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      await this.auditEvent({ actor_user_id: user?.id, action: 'auth.login_failed', resource_type: 'user', resource_id: user?.id, request_id: requestId, metadata: { ipAddress } });
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }
    await this.auditEvent({ actor_user_id: user.id, action: 'auth.login', resource_type: 'user', resource_id: user.id, request_id: requestId, metadata: { ipAddress } });
    return { token: this.tokenFor(user), user: publicUser(user) };
  }

  async currentUser({ userId }) {
    if (!userId) throw new AuthError('UNAUTHORIZED', 'Authentication is required', 401);
    const result = await this.pool.query(
      `SELECT id, email, role, is_active, must_change_password
       FROM sandlabx_users WHERE id = $1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user || !user.is_active) throw new AuthError('UNAUTHORIZED', 'Authentication is required', 401);
    return { user: publicUser(user) };
  }

  async changePassword({ userId, currentPassword, newPassword, requestId }) {
    if (!userId) throw new AuthError('UNAUTHORIZED', 'User not authenticated', 401);
    if (typeof newPassword !== 'string' || newPassword.length < 8) throw new AuthError('VALIDATION_ERROR', 'New password must be at least 8 characters');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT password_hash FROM sandlabx_users WHERE id = $1 FOR UPDATE', [userId]);
      if (!result.rows[0]) throw new AuthError('NOT_FOUND', 'User not found', 404);
      if (!verifyPassword(currentPassword, result.rows[0].password_hash)) throw new AuthError('INVALID_PASSWORD', 'Current password is incorrect');
      await client.query(
        `UPDATE sandlabx_users SET password_hash = $1, must_change_password = FALSE,
         auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [hashPassword(newPassword), userId],
      );
      await this.auditEvent({ actor_user_id: userId, action: 'auth.password_changed', resource_type: 'user', resource_id: userId, request_id: requestId, metadata: {} }, client);
      await client.query('COMMIT');
      return { message: 'Password changed successfully' };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role, mustChangePassword: Boolean(user.must_change_password) };
}

module.exports = { AuthService, AuthError, hashPassword, verifyPassword };
