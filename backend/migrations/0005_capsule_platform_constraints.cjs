'use strict';
exports.up = (pgm) => pgm.sql(`
ALTER TABLE sandlabx_scenario_versions ADD CONSTRAINT scenario_version_digest_format CHECK (content_sha256 ~ '^sha256:[0-9a-f]{64}$');
ALTER TABLE sandlabx_capsule_versions ADD CONSTRAINT capsule_version_digest_format CHECK (content_sha256 ~ '^sha256:[0-9a-f]{64}$');
`);
exports.down = (pgm) => pgm.sql(`ALTER TABLE sandlabx_scenario_versions DROP CONSTRAINT IF EXISTS scenario_version_digest_format; ALTER TABLE sandlabx_capsule_versions DROP CONSTRAINT IF EXISTS capsule_version_digest_format;`);
