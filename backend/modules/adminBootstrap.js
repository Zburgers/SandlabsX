'use strict';

const crypto = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

function validateBootstrapCredentials(env = process.env) {
  const email = env.SANDBOXX_ADMIN_EMAIL;
  const password = env.SANDBOXX_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SANDBOXX_ADMIN_EMAIL and SANDBOXX_ADMIN_PASSWORD are required when sandlabx_users is empty');
  }
  if (!email.includes('@') || password.length < 8) {
    throw new Error('SANDBOXX_ADMIN_EMAIL must be valid and SANDBOXX_ADMIN_PASSWORD must be at least 8 characters');
  }
  return { email: email.trim().toLowerCase(), password };
}

async function createBootstrapAdmin(client, credentials) {
  const count = await client.query('SELECT COUNT(*)::text AS count FROM sandlabx_users');
  if (Number(count.rows[0].count) !== 0) return { created: false };

  const id = credentials.id || uuidv4();
  const result = await client.query(`
    INSERT INTO sandlabx_users
      (id, email, password_hash, role, is_active, must_change_password, auth_version)
    VALUES ($1, $2, $3, 'admin', TRUE, TRUE, 0)
    RETURNING id, email, role, auth_version
  `, [id, credentials.email, hashPassword(credentials.password)]);
  return { created: true, user: result.rows[0] };
}

async function bootstrapAdmin(pool, env = process.env) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('sandlabx:bootstrap-admin', 0))");
    const count = await client.query('SELECT COUNT(*)::text AS count FROM sandlabx_users');
    if (Number(count.rows[0].count) !== 0) {
      await client.query('COMMIT');
      return { created: false };
    }
    const credentials = validateBootstrapCredentials(env);
    const result = await createBootstrapAdmin(client, credentials);
    await client.query('INSERT INTO sandlabx_audit_log (action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4)', [
      'BOOTSTRAP_ADMIN', 'user', result.user.id, JSON.stringify({ email: result.user.email }),
    ]);
    await client.query('COMMIT');
    logger.info({ action: 'bootstrap_admin', userId: result.user.id, email: result.user.email }, 'Bootstrap admin created; password change required');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { bootstrapAdmin, createBootstrapAdmin, validateBootstrapCredentials, hashPassword };
