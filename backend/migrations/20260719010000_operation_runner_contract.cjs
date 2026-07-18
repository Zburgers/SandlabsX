'use strict';
exports.up = (pgm) => pgm.sql(`
ALTER TABLE sandlabx_operations ADD COLUMN IF NOT EXISTS input JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS compensation_state VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED', ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE sandlabx_operation_steps ADD COLUMN IF NOT EXISTS compensation_state VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED', ADD COLUMN IF NOT EXISTS compensated_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS sandlabx_operation_step_attempts (
  id UUID PRIMARY KEY, operation_id UUID NOT NULL REFERENCES sandlabx_operations(id) ON DELETE CASCADE,
  step_key VARCHAR(128) NOT NULL, attempt_number INTEGER NOT NULL CHECK(attempt_number > 0), runner_id VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TIMESTAMPTZ, outcome VARCHAR(24), error JSONB,
  UNIQUE(operation_id, step_key, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_sandlabx_operations_available_lease ON sandlabx_operations(created_at, id) WHERE state IN ('QUEUED','CANCELLING','EXECUTING');
CREATE INDEX IF NOT EXISTS idx_sandlabx_operation_step_attempts_operation ON sandlabx_operation_step_attempts(operation_id, step_key, attempt_number);
`);
exports.down = false;
