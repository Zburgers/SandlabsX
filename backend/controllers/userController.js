'use strict';

const { Pool } = require('pg');
const crypto = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const { auditLogger } = require('../modules/auditLogger');
const { hashPassword } = require('../modules/adminBootstrap');
const { canChangeOwnRole } = require('../modules/userSecurity');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres', port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'guacamole_db', user: process.env.DB_USER || 'guacamole_user',
  password: process.env.DB_PASSWORD || 'guacamole_pass', max: 5, idleTimeoutMillis: 30000,
});
const VALID_ROLES = ['admin', 'instructor', 'student'];

function publicUser(row) {
  return {
    id: row.id, email: row.email, role: row.role, isActive: row.is_active,
    mustChangePassword: row.must_change_password, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function parseFilters(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  const role = query.role || null;
  const status = query.status || null;
  if (role && !VALID_ROLES.includes(role)) throw Object.assign(new Error('Invalid role filter'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (status && !['active', 'disabled'].includes(status)) throw Object.assign(new Error('Invalid status filter'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  return { page, limit, role, status, search: typeof query.search === 'string' ? query.search.trim() : '' };
}

async function listUsers(req, res) {
  try {
    const { page, limit, role, status, search } = parseFilters(req.query);
    const clauses = [];
    const values = [];
    const add = value => { values.push(value); return `$${values.length}`; };
    if (role) clauses.push(`role = ${add(role)}`);
    if (status) clauses.push(`is_active = ${add(status === 'active')}`);
    if (search) clauses.push(`email ILIKE ${add(`%${search}%`)}`);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await pool.query(`SELECT COUNT(*)::int AS count FROM sandlabx_users ${where}`, values);
    const offset = (page - 1) * limit;
    const rows = await pool.query(`SELECT id,email,role,is_active,must_change_password,created_at,updated_at FROM sandlabx_users ${where} ORDER BY created_at DESC LIMIT ${add(limit)} OFFSET ${add(offset)}`, values);
    const total = count.rows[0].count;
    return res.json({ success: true, users: rows.rows.map(publicUser), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error({ err: error, action: 'listUsers' }, 'Failed to list users');
    return res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Failed to list users', code: error.code || 'INTERNAL_ERROR' });
  }
}

async function getUser(req, res) {
  try {
    const result = await pool.query('SELECT id,email,role,is_active,must_change_password,created_at,updated_at FROM sandlabx_users WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'User not found', code: 'NOT_FOUND' });
    return res.json({ success: true, user: publicUser(result.rows[0]) });
  } catch (error) { logger.error({ err: error, action: 'getUser' }, 'Failed to get user'); return res.status(500).json({ success: false, error: 'Failed to get user', code: 'INTERNAL_ERROR' }); }
}

async function createUser(req, res) {
  const { email, password, role = 'student' } = req.body || {};
  if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 8 || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Valid email, password of at least 8 characters, and role are required', code: 'VALIDATION_ERROR' });
  }
  try {
    const result = await pool.query(`INSERT INTO sandlabx_users (id,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,email,role,is_active,must_change_password,created_at,updated_at`, [uuidv4(), email.trim().toLowerCase(), hashPassword(password), role]);
    const user = result.rows[0];
    await auditLogger.log(req.user.id, 'USER_CREATED', 'user', user.id, { email: user.email, role: user.role }, true);
    return res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'A user with this email already exists', code: 'DUPLICATE_EMAIL' });
    logger.error({ err: error, action: 'createUser' }, 'Failed to create user'); return res.status(500).json({ success: false, error: 'Failed to create user', code: 'INTERNAL_ERROR' });
  }
}

async function withLockedUser(id, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('sandlabx:user-admin-mutation', 0))");
    const found = await client.query('SELECT id,email,role,is_active,must_change_password,created_at,updated_at FROM sandlabx_users WHERE id=$1 FOR UPDATE', [id]);
    if (!found.rows.length) { await client.query('ROLLBACK'); return { notFound: true }; }
    const result = await operation(client, found.rows[0]);
    await client.query('COMMIT');
    return { result };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
}

async function ensureActiveAdminRemains(client, target, nextRole, nextActive) {
  const losesAdmin = target.role === 'admin' && (nextRole !== 'admin' || nextActive === false);
  if (!losesAdmin) return;
  const admins = await client.query("SELECT COUNT(*)::int AS count FROM sandlabx_users WHERE role='admin' AND is_active=TRUE AND id <> $1", [target.id]);
  if (admins.rows[0].count < 1) throw Object.assign(new Error('The last active admin cannot be removed'), { statusCode: 409, code: 'LAST_ADMIN' });
}

async function updateUserRole(req, res) {
  const { role } = req.body || {}; const { id } = req.params;
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ success: false, error: 'Invalid role', code: 'VALIDATION_ERROR' });
  if (!canChangeOwnRole(req.user.id, id)) { await auditLogger.log(req.user.id, 'USER_ROLE_CHANGE', 'user', id, { role, reason: 'self-change' }, false); return res.status(403).json({ success: false, error: 'Cannot change your own role', code: 'FORBIDDEN' }); }
  try {
    const outcome = await withLockedUser(id, async (client, target) => {
      await ensureActiveAdminRemains(client, target, role, target.is_active);
      const result = await client.query('UPDATE sandlabx_users SET role=$1, auth_version=auth_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,email,role,is_active,must_change_password,created_at,updated_at', [role, id]);
      return result.rows[0];
    });
    if (outcome.notFound) return res.status(404).json({ success: false, error: 'User not found', code: 'NOT_FOUND' });
    await auditLogger.log(req.user.id, 'USER_ROLE_CHANGED', 'user', id, { role }, true);
    return res.json({ success: true, user: publicUser(outcome.result) });
  } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, error: error.message, code: error.code }); logger.error({ err: error, action: 'updateUserRole' }, 'Failed to update user role'); return res.status(500).json({ success: false, error: 'Failed to update user role', code: 'INTERNAL_ERROR' }); }
}

async function updateUserStatus(req, res) {
  const { id } = req.params; const active = req.body?.isActive;
  if (typeof active !== 'boolean') return res.status(400).json({ success: false, error: 'isActive must be boolean', code: 'VALIDATION_ERROR' });
  if (id === req.user.id && !active) { await auditLogger.log(req.user.id, 'USER_STATUS_CHANGE', 'user', id, { isActive: active, reason: 'self-change' }, false); return res.status(403).json({ success: false, error: 'Cannot disable yourself', code: 'FORBIDDEN' }); }
  try {
    const outcome = await withLockedUser(id, async (client, target) => {
      await ensureActiveAdminRemains(client, target, target.role, active);
      const result = await client.query('UPDATE sandlabx_users SET is_active=$1, auth_version=auth_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,email,role,is_active,must_change_password,created_at,updated_at', [active, id]);
      return result.rows[0];
    });
    if (outcome.notFound) return res.status(404).json({ success: false, error: 'User not found', code: 'NOT_FOUND' });
    await auditLogger.log(req.user.id, active ? 'USER_ENABLED' : 'USER_DISABLED', 'user', id, {}, true);
    return res.json({ success: true, user: publicUser(outcome.result) });
  } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, error: error.message, code: error.code }); logger.error({ err: error, action: 'updateUserStatus' }, 'Failed to update user status'); return res.status(500).json({ success: false, error: 'Failed to update user status', code: 'INTERNAL_ERROR' }); }
}

async function resetPassword(req, res) {
  const temporaryPassword = crypto.randomBytes(12).toString('base64url');
  try {
    const outcome = await withLockedUser(req.params.id, async (client) => {
      const result = await client.query('UPDATE sandlabx_users SET password_hash=$1, must_change_password=TRUE, auth_version=auth_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,email,role,is_active,must_change_password,created_at,updated_at', [hashPassword(temporaryPassword), req.params.id]);
      return result.rows[0];
    });
    if (outcome.notFound) return res.status(404).json({ success: false, error: 'User not found', code: 'NOT_FOUND' });
    await auditLogger.log(req.user.id, 'PASSWORD_RESET', 'user', req.params.id, {}, true);
    return res.json({ success: true, user: publicUser(outcome.result), temporaryPassword });
  } catch (error) { logger.error({ err: error, action: 'resetPassword' }, 'Failed to reset password'); return res.status(500).json({ success: false, error: 'Failed to reset password', code: 'INTERNAL_ERROR' }); }
}

async function deleteUser(req, res) { req.body = { isActive: false }; return updateUserStatus(req, res); }

async function getCurrentUser(req, res) {
  try {
    const result = await pool.query('SELECT id,email,role,is_active,must_change_password,created_at,updated_at FROM sandlabx_users WHERE id=$1', [req.user.id]);
    if (!result.rows.length) return res.status(401).json({ success: false, error: 'User not found', code: 'UNAUTHORIZED' });
    return res.json({ success: true, user: publicUser(result.rows[0]) });
  } catch (error) { logger.error({ err: error, action: 'getCurrentUser' }, 'Failed to get user profile'); return res.status(500).json({ success: false, error: 'Failed to get user profile', code: 'INTERNAL_ERROR' }); }
}

module.exports = { listUsers, getUser, createUser, updateUserRole, updateUserStatus, resetPassword, deleteUser, getCurrentUser, hashPassword };
