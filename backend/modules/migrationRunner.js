'use strict';

/**
 * COMPATIBILITY SCHEMA GATE
 *
 * The historical implementation scanned arbitrary SQL files and created its own
 * migration ledger from inside API startup. That behavior has been retired.
 * Actual migrations are now executed by the dedicated Compose `migrate` service
 * through node-pg-migrate before the backend container is allowed to start.
 *
 * server.js still calls this function while the monolith is being decomposed;
 * it now performs read-only verification only. Remove this compatibility module
 * when startup wiring moves into a dedicated application bootstrap module.
 */
async function runMigrations(pool) {
  const result = await pool.query(`
    SELECT
      to_regclass('public.sandlabx_migrations') AS migration_ledger,
      to_regclass('public.sandlabx_nodes') AS nodes_table,
      to_regclass('public.sandlabx_capsules') AS capsules_table
  `);

  const schema = result.rows[0];
  const missing = [];

  if (!schema.migration_ledger) missing.push('sandlabx_migrations');
  if (!schema.nodes_table) missing.push('sandlabx_nodes');
  if (!schema.capsules_table) missing.push('sandlabx_capsules');

  if (missing.length > 0) {
    const error = new Error(
      `Database migrations have not completed. Missing: ${missing.join(', ')}`,
    );
    error.code = 'SANDLABX_SCHEMA_NOT_READY';
    throw error;
  }
}

module.exports = { runMigrations };
