'use strict';

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE sandlabx_users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    CREATE INDEX IF NOT EXISTS idx_sandlabx_users_active_role ON sandlabx_users(is_active, role);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_sandlabx_users_active_role;
    ALTER TABLE sandlabx_users
      DROP COLUMN IF EXISTS updated_at,
      DROP COLUMN IF EXISTS auth_version,
      DROP COLUMN IF EXISTS must_change_password,
      DROP COLUMN IF EXISTS is_active;
  `);
};
