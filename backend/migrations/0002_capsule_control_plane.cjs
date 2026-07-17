'use strict';

/**
 * Capsule control-plane schema.
 *
 * CREATE IF NOT EXISTS allows adoption of databases where the retired custom
 * migration runner already applied the original SQL file.
 */
exports.up = (pgm) => {
  pgm.sql(String.raw`
    CREATE TABLE IF NOT EXISTS sandlabx_capsules (
      id UUID PRIMARY KEY,
      owner_user_id UUID NOT NULL,
      name VARCHAR(64) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      draft_document JSONB NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
      status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'VALIDATING', 'VALID', 'INVALID', 'PUBLISHED', 'ARCHIVED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (owner_user_id, name)
    );

    CREATE TABLE IF NOT EXISTS sandlabx_capsule_versions (
      id UUID PRIMARY KEY,
      capsule_id UUID NOT NULL REFERENCES sandlabx_capsules(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL CHECK (version_number > 0),
      schema_version VARCHAR(64) NOT NULL,
      normalized_document JSONB NOT NULL,
      content_sha256 VARCHAR(71) NOT NULL,
      published_by UUID NOT NULL,
      published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (capsule_id, version_number),
      UNIQUE (capsule_id, content_sha256)
    );

    CREATE TABLE IF NOT EXISTS sandlabx_lab_instances (
      id UUID PRIMARY KEY,
      capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE RESTRICT,
      owner_user_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      state VARCHAR(24) NOT NULL DEFAULT 'STOPPED'
        CHECK (state IN ('CREATING', 'PROVISIONING', 'STOPPED', 'STARTING', 'RUNNING', 'DEGRADED', 'RECOVERING', 'STOPPING', 'RESETTING', 'FAILED', 'DESTROYING', 'DESTROYED')),
      desired_state VARCHAR(24) NOT NULL DEFAULT 'STOPPED',
      runner_id VARCHAR(255),
      failure_code VARCHAR(64),
      failure_detail JSONB,
      last_reconciled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sandlabx_operations (
      id UUID PRIMARY KEY,
      owner_user_id UUID NOT NULL,
      type VARCHAR(32) NOT NULL,
      resource_type VARCHAR(32) NOT NULL,
      resource_id UUID,
      state VARCHAR(24) NOT NULL DEFAULT 'QUEUED'
        CHECK (state IN ('QUEUED', 'PLANNING', 'RESERVED', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELLING', 'CANCELLED')),
      idempotency_key VARCHAR(255),
      cancel_requested_at TIMESTAMPTZ,
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      result JSONB,
      error JSONB,
      lease_owner VARCHAR(255),
      lease_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (owner_user_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS sandlabx_operation_steps (
      id UUID PRIMARY KEY,
      operation_id UUID NOT NULL REFERENCES sandlabx_operations(id) ON DELETE CASCADE,
      step_key VARCHAR(128) NOT NULL,
      state VARCHAR(24) NOT NULL DEFAULT 'PENDING',
      attempt INTEGER NOT NULL DEFAULT 0,
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      result JSONB,
      error JSONB,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      UNIQUE (operation_id, step_key)
    );

    CREATE TABLE IF NOT EXISTS sandlabx_instance_events (
      id BIGSERIAL PRIMARY KEY,
      operation_id UUID REFERENCES sandlabx_operations(id) ON DELETE CASCADE,
      instance_id UUID REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (operation_id, sequence)
    );

    CREATE TABLE IF NOT EXISTS sandlabx_verification_runs (
      id UUID PRIMARY KEY,
      instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE,
      owner_user_id UUID NOT NULL,
      capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE RESTRICT,
      scenario_id VARCHAR(128),
      status VARCHAR(16) NOT NULL CHECK (status IN ('RUNNING', 'PASSED', 'FAILED', 'CANCELLED')),
      result JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS sandlabx_checkpoints (
      id UUID PRIMARY KEY,
      instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE,
      owner_user_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      state VARCHAR(16) NOT NULL CHECK (state IN ('CREATING', 'READY', 'RESTORED', 'FAILED')),
      manifest JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sandlabx_artifacts (
      id UUID PRIMARY KEY,
      instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE,
      owner_user_id UUID NOT NULL,
      type VARCHAR(64) NOT NULL,
      storage_path TEXT NOT NULL,
      sha256 VARCHAR(64) NOT NULL,
      size_bytes BIGINT NOT NULL,
      redacted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sandlabx_capsules_owner
      ON sandlabx_capsules(owner_user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_instances_owner
      ON sandlabx_lab_instances(owner_user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_operations_queue
      ON sandlabx_operations(state, created_at);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_instance_events_instance
      ON sandlabx_instance_events(instance_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_verification_runs_instance
      ON sandlabx_verification_runs(instance_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_checkpoints_instance
      ON sandlabx_checkpoints(instance_id, created_at DESC);
  `);
};

exports.down = false;
