'use strict';
exports.up = pgm => pgm.sql(`
CREATE TABLE IF NOT EXISTS sandlabx_execution_plans (
  id UUID PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES sandlabx_lab_instances(id) ON DELETE CASCADE,
  capsule_version_id UUID NOT NULL REFERENCES sandlabx_capsule_versions(id) ON DELETE RESTRICT,
  semantic_hash VARCHAR(71) NOT NULL,
  full_hash VARCHAR(71) NOT NULL,
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(instance_id), UNIQUE(full_hash)
);
CREATE INDEX IF NOT EXISTS idx_sandlabx_execution_plans_instance ON sandlabx_execution_plans(instance_id);
`);
exports.down = false;
