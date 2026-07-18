'use strict';

// Additive final Capsule platform schema. Legacy lab tables remain readable
// until the cutover preflight proves that they are empty.
exports.up = (pgm) => pgm.sql(`
CREATE TABLE IF NOT EXISTS sandlabx_capsule_drafts (
  id UUID PRIMARY KEY, capsule_id UUID NOT NULL REFERENCES sandlabx_capsules(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT, document JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (capsule_id, revision)
);
CREATE TABLE IF NOT EXISTS sandlabx_capsule_version_artifacts (
  id UUID PRIMARY KEY, capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE CASCADE,
  artifact_key VARCHAR(128) NOT NULL, digest VARCHAR(71) NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(capsule_version_id, artifact_key)
);
CREATE TABLE IF NOT EXISTS sandlabx_scenarios (
  id UUID PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT, name VARCHAR(64) NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_user_id, name)
);
CREATE TABLE IF NOT EXISTS sandlabx_scenario_drafts (
  id UUID PRIMARY KEY, scenario_id UUID NOT NULL REFERENCES sandlabx_scenarios(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT, document JSONB NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(scenario_id, revision)
);
CREATE TABLE IF NOT EXISTS sandlabx_scenario_versions (
  id UUID PRIMARY KEY, scenario_id UUID NOT NULL REFERENCES sandlabx_scenarios(id) ON DELETE CASCADE, version_number INTEGER NOT NULL CHECK(version_number > 0),
  capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE RESTRICT, document JSONB NOT NULL, content_sha256 VARCHAR(71) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scenario_id, version_number), UNIQUE(scenario_id, content_sha256)
);
CREATE TABLE IF NOT EXISTS sandlabx_scenario_capsule_compatibility (
  scenario_version_id UUID NOT NULL REFERENCES sandlabx_scenario_versions(id) ON DELETE CASCADE, capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE RESTRICT,
  compatibility JSONB NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY(scenario_version_id, capsule_version_id)
);
CREATE TABLE IF NOT EXISTS sandlabx_bundles (
  id UUID PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT, name VARCHAR(64) NOT NULL, revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_user_id, name)
);
CREATE TABLE IF NOT EXISTS sandlabx_bundle_versions (
  id UUID PRIMARY KEY, bundle_id UUID NOT NULL REFERENCES sandlabx_bundles(id) ON DELETE CASCADE, version_number INTEGER NOT NULL CHECK(version_number > 0), manifest JSONB NOT NULL, content_sha256 VARCHAR(71) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(bundle_id, version_number), UNIQUE(bundle_id, content_sha256)
);
CREATE TABLE IF NOT EXISTS sandlabx_bundle_members (
  id UUID PRIMARY KEY, bundle_version_id UUID NOT NULL REFERENCES sandlabx_bundle_versions(id) ON DELETE CASCADE, member_type VARCHAR(32) NOT NULL CHECK(member_type IN ('CAPSULE_VERSION','SCENARIO_VERSION','CONFIGURATION_ARTIFACT')), member_id UUID NOT NULL, digest VARCHAR(71) NOT NULL, UNIQUE(bundle_version_id, member_type, member_id)
);
CREATE TABLE IF NOT EXISTS sandlabx_instance_nodes (
  id UUID PRIMARY KEY, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE, logical_id VARCHAR(64) NOT NULL, driver VARCHAR(128) NOT NULL, state VARCHAR(24) NOT NULL DEFAULT 'STOPPED', process_identity JSONB, overlay_path TEXT, UNIQUE(instance_id, logical_id)
);
CREATE TABLE IF NOT EXISTS sandlabx_instance_disks (
  id UUID PRIMARY KEY, node_id UUID NOT NULL CONSTRAINT fk_instance_disks_node REFERENCES sandlabx_instance_nodes(id) ON DELETE CASCADE, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE, disk_key VARCHAR(64) NOT NULL, overlay_path TEXT NOT NULL, base_digest VARCHAR(71), state VARCHAR(24) NOT NULL DEFAULT 'ALLOCATED', ownership JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(node_id, disk_key), UNIQUE(overlay_path)
);
CREATE TABLE IF NOT EXISTS sandlabx_network_segments (
  id UUID PRIMARY KEY, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE, segment_key VARCHAR(128) NOT NULL, bridge_name VARCHAR(64), state VARCHAR(24) NOT NULL DEFAULT 'ALLOCATED', ownership JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(instance_id, segment_key), UNIQUE(bridge_name)
);
CREATE TABLE IF NOT EXISTS sandlabx_instance_interfaces (
  id UUID PRIMARY KEY, node_id UUID NOT NULL REFERENCES sandlabx_instance_nodes(id) ON DELETE CASCADE, logical_id VARCHAR(64) NOT NULL, mac_address MACADDR, tap_name VARCHAR(64), segment_id UUID REFERENCES sandlabx_network_segments(id) ON DELETE SET NULL, allocation_state VARCHAR(24) NOT NULL DEFAULT 'ALLOCATED', ownership JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(node_id, logical_id), UNIQUE(mac_address), UNIQUE(tap_name)
);
CREATE TABLE IF NOT EXISTS sandlabx_network_allocations (
  id UUID PRIMARY KEY, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE, interface_id UUID NOT NULL CONSTRAINT fk_network_allocations_interface REFERENCES sandlabx_instance_interfaces(id) ON DELETE CASCADE, allocation_type VARCHAR(32) NOT NULL, allocation_key VARCHAR(128) NOT NULL, released_at TIMESTAMPTZ, ownership JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS sandlabx_console_endpoints (
  id UUID PRIMARY KEY, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE, node_id UUID REFERENCES sandlabx_instance_nodes(id) ON DELETE CASCADE, console_type VARCHAR(32) NOT NULL, endpoint VARCHAR(512) NOT NULL, port INTEGER, state VARCHAR(24) NOT NULL DEFAULT 'ALLOCATED', ownership JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(instance_id, node_id, console_type), UNIQUE(port)
);
CREATE TABLE IF NOT EXISTS sandlabx_resource_reservations (
  id UUID PRIMARY KEY, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE, resource_type VARCHAR(32) NOT NULL, resource_key VARCHAR(128) NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), state VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', UNIQUE(resource_type, resource_key)
);
CREATE TABLE IF NOT EXISTS sandlabx_runtime_observations (
  id BIGSERIAL PRIMARY KEY, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE, node_id UUID REFERENCES sandlabx_instance_nodes(id) ON DELETE CASCADE, observed_state VARCHAR(24) NOT NULL, detail JSONB NOT NULL DEFAULT '{}'::jsonb, observed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sandlabx_operation_attempts (
  id UUID PRIMARY KEY, operation_id UUID NOT NULL REFERENCES sandlabx_operations(id) ON DELETE CASCADE, attempt_number INTEGER NOT NULL CHECK(attempt_number > 0), runner_id VARCHAR(255), started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TIMESTAMPTZ, outcome VARCHAR(24), error JSONB, UNIQUE(operation_id, attempt_number)
);
CREATE TABLE IF NOT EXISTS sandlabx_audit_events (
  id BIGSERIAL PRIMARY KEY, actor_user_id UUID REFERENCES sandlabx_users(id) ON DELETE SET NULL, action VARCHAR(128) NOT NULL, resource_type VARCHAR(64) NOT NULL, resource_id UUID, request_id VARCHAR(128), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sandlabx_verification_results (
  id UUID PRIMARY KEY, verification_run_id UUID NOT NULL REFERENCES sandlabx_verification_runs(id) ON DELETE CASCADE, check_key VARCHAR(128) NOT NULL, outcome VARCHAR(16) NOT NULL CHECK(outcome IN ('PASSED','FAILED','SKIPPED','ERROR')), evidence JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(verification_run_id, check_key)
);
CREATE TABLE IF NOT EXISTS sandlabx_checkpoint_node_disks (
  id UUID PRIMARY KEY, checkpoint_id UUID NOT NULL REFERENCES sandlabx_checkpoints(id) ON DELETE CASCADE, node_id UUID NOT NULL REFERENCES sandlabx_instance_nodes(id) ON DELETE RESTRICT, disk_id UUID NOT NULL REFERENCES sandlabx_instance_disks(id) ON DELETE RESTRICT, storage_path TEXT NOT NULL, sha256 VARCHAR(71) NOT NULL, size_bytes BIGINT NOT NULL CHECK(size_bytes >= 0), UNIQUE(checkpoint_id, node_id, disk_id)
);
CREATE TABLE IF NOT EXISTS sandlabx_configuration_artifacts (
  id UUID PRIMARY KEY, capsule_version_id UUID REFERENCES sandlabx_capsule_versions(id) ON DELETE CASCADE, owner_user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT, artifact_key VARCHAR(128) NOT NULL, storage_path TEXT NOT NULL, sha256 VARCHAR(71) NOT NULL, size_bytes BIGINT NOT NULL CHECK(size_bytes >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(capsule_version_id, artifact_key), UNIQUE(storage_path)
);
CREATE TABLE IF NOT EXISTS sandlabx_image_capture_operations (
  id UUID PRIMARY KEY, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE RESTRICT, node_id UUID NOT NULL REFERENCES sandlabx_instance_nodes(id) ON DELETE RESTRICT, operation_id UUID NOT NULL REFERENCES sandlabx_operations(id) ON DELETE RESTRICT, image_digest VARCHAR(71), state VARCHAR(24) NOT NULL DEFAULT 'QUEUED', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(operation_id)
);
CREATE TABLE IF NOT EXISTS sandlabx_assignments (
  id UUID PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT, capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE RESTRICT, scenario_version_id UUID NOT NULL REFERENCES sandlabx_scenario_versions(id) ON DELETE RESTRICT, name VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assignment_exact_version_unique UNIQUE(owner_user_id, capsule_version_id, scenario_version_id, name)
);
CREATE TABLE IF NOT EXISTS sandlabx_assignment_members (
  assignment_id UUID NOT NULL CONSTRAINT fk_assignment_members_assignment REFERENCES sandlabx_assignments(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE CASCADE, role VARCHAR(24) NOT NULL DEFAULT 'student', joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(assignment_id, user_id)
);
CREATE TABLE IF NOT EXISTS sandlabx_scenario_attempts (
  id UUID PRIMARY KEY, assignment_id UUID NOT NULL CONSTRAINT fk_scenario_attempts_assignment REFERENCES sandlabx_assignments(id) ON DELETE RESTRICT, owner_user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT, instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE RESTRICT, capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE RESTRICT, scenario_version_id UUID NOT NULL REFERENCES sandlabx_scenario_versions(id) ON DELETE RESTRICT, state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sandlabx_scenario_stage_progress (
  attempt_id UUID NOT NULL REFERENCES sandlabx_scenario_attempts(id) ON DELETE CASCADE, stage_key VARCHAR(128) NOT NULL, state VARCHAR(24) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(attempt_id, stage_key)
);
CREATE TABLE IF NOT EXISTS sandlabx_scenario_check_results (
  id UUID PRIMARY KEY, attempt_id UUID NOT NULL REFERENCES sandlabx_scenario_attempts(id) ON DELETE CASCADE, stage_key VARCHAR(128) NOT NULL, check_key VARCHAR(128) NOT NULL, outcome VARCHAR(16) NOT NULL, evidence JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(attempt_id, stage_key, check_key)
);
CREATE TABLE IF NOT EXISTS sandlabx_scores (
  id UUID PRIMARY KEY, attempt_id UUID NOT NULL REFERENCES sandlabx_scenario_attempts(id) ON DELETE CASCADE, score NUMERIC(8,2) NOT NULL CHECK(score >= 0), maximum_score NUMERIC(8,2) NOT NULL CHECK(maximum_score >= score), detail JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(attempt_id)
);
CREATE INDEX IF NOT EXISTS idx_sandlabx_operation_attempts_operation ON sandlabx_operation_attempts(operation_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_sandlabx_runtime_observations_instance ON sandlabx_runtime_observations(instance_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sandlabx_verification_results_run ON sandlabx_verification_results(verification_run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sandlabx_scenario_attempts_owner ON sandlabx_scenario_attempts(owner_user_id, created_at DESC);
`);
exports.down = false;
