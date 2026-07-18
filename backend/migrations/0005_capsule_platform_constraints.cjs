'use strict';
exports.up = (pgm) => pgm.sql(`
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE sandlabx_scenario_versions ADD CONSTRAINT scenario_version_digest_format CHECK (content_sha256 ~ '^sha256:[0-9a-f]{64}$');
ALTER TABLE sandlabx_capsule_versions ADD CONSTRAINT capsule_version_digest_format CHECK (content_sha256 ~ '^sha256:[0-9a-f]{64}$');
ALTER TABLE sandlabx_network_allocations ADD CONSTRAINT network_allocation_live_unique EXCLUDE USING gist (allocation_type WITH =, allocation_key WITH =) WHERE (released_at IS NULL);
CREATE OR REPLACE FUNCTION sandlabx_prevent_immutable_version_mutation() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'immutable version rows cannot be modified'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER sandlabx_capsule_versions_immutable BEFORE UPDATE OR DELETE ON sandlabx_capsule_versions FOR EACH ROW EXECUTE FUNCTION sandlabx_prevent_immutable_version_mutation();
CREATE TRIGGER sandlabx_scenario_versions_immutable BEFORE UPDATE OR DELETE ON sandlabx_scenario_versions FOR EACH ROW EXECUTE FUNCTION sandlabx_prevent_immutable_version_mutation();
CREATE TRIGGER sandlabx_bundle_versions_immutable BEFORE UPDATE OR DELETE ON sandlabx_bundle_versions FOR EACH ROW EXECUTE FUNCTION sandlabx_prevent_immutable_version_mutation();
`);
exports.down = false;
