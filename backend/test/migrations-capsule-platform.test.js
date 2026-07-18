'use strict';

const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { ImageArtifactRepository } = require('../repositories/imageArtifactRepository');
const { WorkloadProfileRepository } = require('../repositories/workloadProfileRepository');
const { ImageArtifactService } = require('../services/imageArtifactService');
const { WorkloadProfileService } = require('../services/workloadProfileService');

const run = promisify(execFile);
const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://guacamole_user:guacamole_pass@127.0.0.1:5432/guacamole_db';
const databaseName = `sandlabx_capsule_test_${crypto.randomUUID().replaceAll('-', '')}`;
const url = new URL(baseUrl); url.pathname = `/${databaseName}`;
const disposableUrl = url.toString();
const expectedTables = ['sandlabx_capsules', 'sandlabx_capsule_drafts', 'sandlabx_capsule_versions', 'sandlabx_capsule_version_artifacts', 'sandlabx_scenarios', 'sandlabx_scenario_drafts', 'sandlabx_scenario_versions', 'sandlabx_scenario_capsule_compatibility', 'sandlabx_bundles', 'sandlabx_bundle_versions', 'sandlabx_bundle_members', 'sandlabx_lab_instances', 'sandlabx_instance_nodes', 'sandlabx_instance_disks', 'sandlabx_instance_interfaces', 'sandlabx_network_segments', 'sandlabx_network_allocations', 'sandlabx_console_endpoints', 'sandlabx_resource_reservations', 'sandlabx_runtime_observations', 'sandlabx_operations', 'sandlabx_operation_steps', 'sandlabx_operation_attempts', 'sandlabx_instance_events', 'sandlabx_audit_events', 'sandlabx_verification_runs', 'sandlabx_verification_results', 'sandlabx_artifacts', 'sandlabx_checkpoints', 'sandlabx_checkpoint_node_disks', 'sandlabx_configuration_artifacts', 'sandlabx_image_capture_operations', 'sandlabx_assignments', 'sandlabx_assignment_members', 'sandlabx_scenario_attempts', 'sandlabx_scenario_stage_progress', 'sandlabx_scenario_check_results', 'sandlabx_scores', 'sandlabx_image_artifact_versions', 'sandlabx_workload_profile_versions'];

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
  const constraints = await client.query(`SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])`, [['capsule_version_digest_format', 'scenario_version_digest_format', 'network_allocation_live_unique', 'assignment_exact_version_unique', 'image_artifact_digest_format', 'workload_profile_digest_format']]);
  assert.equal(constraints.rowCount, 6);
  const indexes = await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`, [['idx_sandlabx_operation_attempts_operation', 'idx_sandlabx_runtime_observations_instance', 'idx_sandlabx_verification_results_run']]);
  assert.equal(indexes.rowCount, 3);
  const foreignKeys = await client.query(`SELECT conname FROM pg_constraint WHERE contype = 'f' AND conname = ANY($1::text[])`, [['fk_instance_disks_node', 'fk_network_allocations_interface', 'fk_assignment_members_assignment', 'fk_scenario_attempts_assignment']]);
  assert.equal(foreignKeys.rowCount, 4);
  await client.query(`INSERT INTO sandlabx_users (id, email, password_hash, role) VALUES ('00000000-0000-0000-0000-000000000001', 'adopted@example.test', 'x', 'admin')`);
  await migrate();
  const adopted = await client.query(`SELECT email FROM sandlabx_users WHERE email = 'adopted@example.test'`); assert.equal(adopted.rowCount, 1);

  const images = new ImageArtifactService({ repository: new ImageArtifactRepository({ pool: client }) });
  const firstImage = await images.publish({ name: 'router', digest: `sha256:${'a'.repeat(64)}`, format: 'qcow2', storagePath: '/images/router-v1.qcow2', sizeBytes: 1, provenance: { kind: 'TEST' } });
  const secondImage = await images.publish({ name: 'router', digest: `sha256:${'b'.repeat(64)}`, format: 'qcow2', storagePath: '/images/router-v2.qcow2', sizeBytes: 2, provenance: { kind: 'TEST' } });
  assert.equal(firstImage.versionNumber, 1); assert.equal(secondImage.versionNumber, 2);

  const profiles = new WorkloadProfileService({ repository: new WorkloadProfileRepository({ pool: client }) });
  const baseProfile = { id: 'qemu-router', version: 'draft', architecture: 'x86_64', acceleration: ['kvm'], machine: 'q35', console: 'serial', consoles: ['serial'], resources: { minVcpus: 1, maxVcpus: 2, minMemoryMiB: 512, maxMemoryMiB: 2048 }, interfaces: { max: 4, models: ['virtio-net'] }, disks: { max: 2, formats: ['qcow2'] }, capabilities: { capture: true }, supportedImage: { architectures: ['x86_64'], formats: ['qcow2'] }, permittedNodeOverrides: [] };
  const firstProfile = await profiles.publish(baseProfile);
  const secondProfile = await profiles.publish({ ...baseProfile, resources: { ...baseProfile.resources, maxVcpus: 4 } });
  assert.equal(firstProfile.versionNumber, 1); assert.equal(secondProfile.versionNumber, 2);
  await assert.rejects(client.query('UPDATE sandlabx_image_artifact_versions SET artifact_name = $1 WHERE id = $2', ['changed', firstImage.id]), /immutable version rows cannot be modified/);
});
