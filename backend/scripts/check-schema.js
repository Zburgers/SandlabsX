'use strict';

const { Client } = require('pg');

const requiredTables = [
  'sandlabx_migrations',
  'sandlabx_users',
  'sandlabx_labs',
  'sandlabx_images',
  'sandlabx_audit_log',
  'sandlabx_nodes',
  'sandlabx_console_sessions',
  'sandlabx_connections',
  'sandlabx_capsules',
  'sandlabx_capsule_versions',
  'sandlabx_lab_instances',
  'sandlabx_operations',
  'sandlabx_operation_steps',
  'sandlabx_instance_events',
  'sandlabx_verification_runs',
  'sandlabx_checkpoints',
  'sandlabx_artifacts',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for schema verification.');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const result = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [requiredTables],
    );

    const present = new Set(result.rows.map((row) => row.table_name));
    const missing = requiredTables.filter((table) => !present.has(table));

    if (missing.length > 0) {
      throw new Error(`Required migrated tables are missing: ${missing.join(', ')}`);
    }

    const legacyLedger = await client.query(
      "SELECT to_regclass('public.sandlabx_schema_migrations') AS legacy_table",
    );

    if (legacyLedger.rows[0].legacy_table) {
      throw new Error('Legacy sandlabx_schema_migrations ledger still exists.');
    }

    const applied = await client.query(
      'SELECT name, run_on FROM sandlabx_migrations ORDER BY id',
    );

    console.log(`[sandlabx-schema] ${requiredTables.length} required tables verified`);
    console.log(`[sandlabx-schema] ${applied.rowCount} migration(s) recorded`);
    for (const migration of applied.rows) {
      console.log(`[sandlabx-schema] applied ${migration.name}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[sandlabx-schema] Schema verification failed');
  console.error(error);
  process.exit(1);
});
