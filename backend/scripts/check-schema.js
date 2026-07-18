'use strict';

const { Client } = require('pg');

const requiredTables = [
  'sandlabx_migrations',
  'sandlabx_users',
  'sandlabx_images',
  'sandlabx_audit_log',
  'sandlabx_capsules',
  'sandlabx_capsule_drafts',
  'sandlabx_capsule_versions',
  'sandlabx_capsule_private_revisions',
  'sandlabx_capsule_version_artifacts',
  'sandlabx_scenarios',
  'sandlabx_scenario_drafts',
  'sandlabx_scenario_versions',
  'sandlabx_scenario_capsule_compatibility',
  'sandlabx_bundles',
  'sandlabx_bundle_versions',
  'sandlabx_bundle_members',
  'sandlabx_lab_instances',
  'sandlabx_instance_nodes',
  'sandlabx_instance_disks',
  'sandlabx_instance_interfaces',
  'sandlabx_network_segments',
  'sandlabx_network_allocations',
  'sandlabx_console_endpoints',
  'sandlabx_resource_reservations',
  'sandlabx_runtime_observations',
  'sandlabx_operations',
  'sandlabx_operation_steps',
  'sandlabx_operation_attempts',
  'sandlabx_instance_events',
  'sandlabx_audit_events',
  'sandlabx_verification_runs',
  'sandlabx_verification_results',
  'sandlabx_checkpoints',
  'sandlabx_checkpoint_node_disks',
  'sandlabx_configuration_artifacts',
  'sandlabx_image_capture_operations',
  'sandlabx_artifacts',
  'sandlabx_assignments',
  'sandlabx_assignment_members',
  'sandlabx_scenario_attempts',
  'sandlabx_scenario_stage_progress',
  'sandlabx_scenario_check_results',
  'sandlabx_scores',
  'sandlabx_image_artifact_versions',
  'sandlabx_workload_profile_versions',
];

const requiredConstraints = [
  'capsule_version_digest_format',
  'scenario_version_digest_format',
  'network_allocation_live_unique',
  'assignment_exact_version_unique',
  'image_artifact_digest_format',
  'workload_profile_digest_format',
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

    const constraints = await client.query(
      `SELECT conname
         FROM pg_constraint
        WHERE conname = ANY($1::text[])`,
      [requiredConstraints],
    );
    const presentConstraints = new Set(constraints.rows.map((row) => row.conname));
    const missingConstraints = requiredConstraints.filter(
      (constraint) => !presentConstraints.has(constraint),
    );
    if (missingConstraints.length > 0) {
      throw new Error(`Required Capsule constraints are missing: ${missingConstraints.join(', ')}`);
    }

    const applied = await client.query(
      'SELECT name, run_on FROM sandlabx_migrations ORDER BY id',
    );
    const expectedMigration = '20260719000000_user_account_security';
    if (!applied.rows.some((migration) => migration.name === expectedMigration)) {
      throw new Error(`Required migration is not recorded: ${expectedMigration}`);
    }

    console.log(`[sandlabx-schema] ${requiredTables.length} required tables verified`);
    console.log(`[sandlabx-schema] ${requiredConstraints.length} Capsule constraints verified`);
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
