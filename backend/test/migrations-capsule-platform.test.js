'use strict';

const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

const run = promisify(execFile);
const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://guacamole_user:guacamole_pass@127.0.0.1:5432/guacamole_db';
const databaseName = `sandlabx_capsule_test_${crypto.randomUUID().replaceAll('-', '')}`;
const url = new URL(baseUrl); url.pathname = `/${databaseName}`;
const disposableUrl = url.toString();
const expectedTables = ['sandlabx_capsules', 'sandlabx_capsule_drafts', 'sandlabx_capsule_versions', 'sandlabx_capsule_version_artifacts', 'sandlabx_scenarios', 'sandlabx_scenario_drafts', 'sandlabx_scenario_versions', 'sandlabx_scenario_capsule_compatibility', 'sandlabx_bundles', 'sandlabx_bundle_versions', 'sandlabx_bundle_members', 'sandlabx_lab_instances', 'sandlabx_instance_nodes', 'sandlabx_instance_disks', 'sandlabx_instance_interfaces', 'sandlabx_network_segments', 'sandlabx_network_allocations', 'sandlabx_console_endpoints', 'sandlabx_resource_reservations', 'sandlabx_runtime_observations', 'sandlabx_operations', 'sandlabx_operation_steps', 'sandlabx_operation_attempts', 'sandlabx_instance_events', 'sandlabx_audit_events', 'sandlabx_verification_runs', 'sandlabx_verification_results', 'sandlabx_artifacts', 'sandlabx_checkpoints', 'sandlabx_checkpoint_node_disks', 'sandlabx_configuration_artifacts', 'sandlabx_image_capture_operations', 'sandlabx_assignments', 'sandlabx_assignment_members', 'sandlabx_scenario_attempts', 'sandlabx_scenario_stage_progress', 'sandlabx_scenario_check_results', 'sandlabx_scores'];

async function adminClient() { const admin = new Client({ connectionString: baseUrl }); await admin.connect(); return admin; }
async function migrate() { await run(process.execPath, ['scripts/migrate.js', 'up'], { cwd: __dirname + '/..', env: { ...process.env, DATABASE_URL: disposableUrl } }); }

test('final Capsule schema migrates fresh and adopted databases with constraints, indexes, FKs, and safe reruns', async (t) => {
  const admin = await adminClient();
  await admin.query(`CREATE DATABASE ${databaseName}`);
  await migrate();
  const client = new Client({ connectionString: disposableUrl }); await client.connect();
  t.after(async () => { await client.end(); await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`); await admin.end(); });
  const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [expectedTables]);
  assert.deepEqual(new Set(tables.rows.map((row) => row.table_name)), new Set(expectedTables));
  const constraints = await client.query(`SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])`, [['capsule_version_digest_format', 'scenario_version_digest_format', 'network_allocation_live_unique', 'assignment_exact_version_unique']]);
  assert.equal(constraints.rowCount, 4);
  const indexes = await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`, [['idx_sandlabx_operation_attempts_operation', 'idx_sandlabx_runtime_observations_instance', 'idx_sandlabx_verification_results_run']]);
  assert.equal(indexes.rowCount, 3);
  const foreignKeys = await client.query(`SELECT conname FROM pg_constraint WHERE contype = 'f' AND conname = ANY($1::text[])`, [['fk_instance_disks_node', 'fk_network_allocations_interface', 'fk_assignment_members_assignment', 'fk_scenario_attempts_assignment']]);
  assert.equal(foreignKeys.rowCount, 4);
  await client.query(`INSERT INTO sandlabx_users (id, email, password_hash, role) VALUES ('00000000-0000-0000-0000-000000000001', 'adopted@example.test', 'x', 'admin')`);
  await migrate();
  const adopted = await client.query(`SELECT email FROM sandlabx_users WHERE email = 'adopted@example.test'`); assert.equal(adopted.rowCount, 1);
});
