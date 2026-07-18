'use strict';

exports.up = (pgm) => pgm.sql(`
CREATE TABLE sandlabx_image_artifact_versions (
  id UUID PRIMARY KEY,
  artifact_name VARCHAR(255) NOT NULL,
  version_number INTEGER NOT NULL CHECK(version_number > 0),
  digest VARCHAR(71) NOT NULL CONSTRAINT image_artifact_digest_format CHECK(digest ~ '^sha256:[0-9a-f]{64}$'),
  format VARCHAR(32) NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes >= 0),
  virtual_size_bytes BIGINT CHECK(virtual_size_bytes IS NULL OR virtual_size_bytes >= 0),
  architecture VARCHAR(64),
  provenance JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artifact_name, version_number),
  UNIQUE(digest),
  UNIQUE(storage_path)
);

CREATE TABLE sandlabx_workload_profile_versions (
  id UUID PRIMARY KEY,
  profile_name VARCHAR(255) NOT NULL,
  version_number INTEGER NOT NULL CHECK(version_number > 0),
  content_sha256 VARCHAR(71) NOT NULL CONSTRAINT workload_profile_digest_format CHECK(content_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  profile JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_name, version_number),
  UNIQUE(content_sha256)
);

CREATE INDEX idx_sandlabx_image_artifacts_name
  ON sandlabx_image_artifact_versions(artifact_name, version_number DESC);
CREATE INDEX idx_sandlabx_workload_profiles_name
  ON sandlabx_workload_profile_versions(profile_name, version_number DESC);

CREATE TRIGGER sandlabx_image_artifact_versions_immutable
  BEFORE UPDATE OR DELETE ON sandlabx_image_artifact_versions
  FOR EACH ROW EXECUTE FUNCTION sandlabx_prevent_immutable_version_mutation();
CREATE TRIGGER sandlabx_workload_profile_versions_immutable
  BEFORE UPDATE OR DELETE ON sandlabx_workload_profile_versions
  FOR EACH ROW EXECUTE FUNCTION sandlabx_prevent_immutable_version_mutation();
`);

exports.down = (pgm) => pgm.sql(`
DROP TRIGGER IF EXISTS sandlabx_workload_profile_versions_immutable ON sandlabx_workload_profile_versions;
DROP TRIGGER IF EXISTS sandlabx_image_artifact_versions_immutable ON sandlabx_image_artifact_versions;
DROP TABLE IF EXISTS sandlabx_workload_profile_versions;
DROP TABLE IF EXISTS sandlabx_image_artifact_versions;
`);
