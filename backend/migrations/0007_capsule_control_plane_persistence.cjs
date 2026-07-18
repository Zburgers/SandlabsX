'use strict';

exports.up = (pgm) => pgm.sql(`
CREATE TABLE IF NOT EXISTS sandlabx_capsule_private_revisions (
  id UUID PRIMARY KEY,
  capsule_id UUID NOT NULL REFERENCES sandlabx_capsules(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK(revision_number > 0),
  schema_version VARCHAR(64) NOT NULL,
  normalized_document JSONB NOT NULL,
  content_sha256 VARCHAR(71) NOT NULL CHECK(content_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  created_by UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(capsule_id, revision_number),
  UNIQUE(capsule_id, content_sha256)
);

ALTER TABLE sandlabx_capsules
  ADD COLUMN IF NOT EXISTS published_version_counter INTEGER NOT NULL DEFAULT 0 CHECK(published_version_counter >= 0),
  ADD COLUMN IF NOT EXISTS private_revision_counter INTEGER NOT NULL DEFAULT 0 CHECK(private_revision_counter >= 0);
ALTER TABLE sandlabx_operations
  ADD COLUMN IF NOT EXISTS event_sequence INTEGER NOT NULL DEFAULT 0 CHECK(event_sequence >= 0);

-- Preserve legacy draft content exactly once, then make the final draft table
-- the only authoritative source. The legacy column stays for rolling upgrades.
INSERT INTO sandlabx_capsule_drafts (id, capsule_id, owner_user_id, document, revision, created_at, updated_at)
SELECT c.id, c.id, c.owner_user_id, c.draft_document, c.revision, c.created_at, c.updated_at
FROM sandlabx_capsules c
WHERE NOT EXISTS (SELECT 1 FROM sandlabx_capsule_drafts d WHERE d.capsule_id = c.id);

UPDATE sandlabx_capsules SET draft_document = '{}'::jsonb WHERE draft_document <> '{}'::jsonb;

UPDATE sandlabx_capsules c SET published_version_counter = COALESCE((SELECT MAX(v.version_number) FROM sandlabx_capsule_versions v WHERE v.capsule_id=c.id), 0);
UPDATE sandlabx_capsules c SET private_revision_counter = COALESCE((SELECT MAX(v.revision_number) FROM sandlabx_capsule_private_revisions v WHERE v.capsule_id=c.id), 0);

CREATE INDEX IF NOT EXISTS idx_sandlabx_capsule_drafts_current
  ON sandlabx_capsule_drafts(capsule_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_sandlabx_capsule_private_revisions_current
  ON sandlabx_capsule_private_revisions(capsule_id, revision_number DESC);

CREATE TRIGGER sandlabx_capsule_private_revisions_immutable
  BEFORE UPDATE OR DELETE ON sandlabx_capsule_private_revisions
  FOR EACH ROW EXECUTE FUNCTION sandlabx_prevent_immutable_version_mutation();
`);

exports.down = false;
