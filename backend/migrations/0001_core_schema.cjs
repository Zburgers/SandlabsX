'use strict';

/**
 * Authoritative SandLabX core-schema baseline.
 *
 * This migration is deliberately idempotent because it must adopt databases
 * created by the retired initdb SQL files as well as completely fresh databases.
 * It never deletes application data.
 */
exports.up = (pgm) => {
  pgm.sql(String.raw`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS sandlabx_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'student',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT sandlabx_users_role_check
        CHECK (role IN ('admin', 'instructor', 'student'))
    );

    CREATE TABLE IF NOT EXISTS sandlabx_labs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      user_id UUID NOT NULL,
      topology_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      template_name VARCHAR(255),
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sandlabx_labs_user
        FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sandlabx_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      path VARCHAR(512) NOT NULL,
      format VARCHAR(20) NOT NULL DEFAULT 'qcow2',
      size_gb DECIMAL(10, 2),
      os_type VARCHAR(50),
      is_valid BOOLEAN NOT NULL DEFAULT TRUE,
      user_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sandlabx_images_user
        FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL,
      CONSTRAINT sandlabx_images_format_check
        CHECK (format IN ('qcow2', 'raw', 'vmdk'))
    );

    CREATE TABLE IF NOT EXISTS sandlabx_audit_log (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50),
      resource_id UUID,
      details JSONB,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sandlabx_audit_log_user
        FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sandlabx_nodes (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      os_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'stopped',
      overlay_path TEXT NOT NULL,
      vnc_port INTEGER,
      guac_connection_id INTEGER,
      guac_url TEXT,
      pid INTEGER,
      ram_mb INTEGER NOT NULL DEFAULT 2048,
      cpu_cores INTEGER NOT NULL DEFAULT 2,
      image_metadata JSONB,
      user_id UUID,
      lab_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMPTZ,
      stopped_at TIMESTAMPTZ,
      wiped_at TIMESTAMPTZ,
      CONSTRAINT sandlabx_nodes_status_check
        CHECK (status IN ('stopped', 'starting', 'running', 'stopping', 'error')),
      CONSTRAINT fk_sandlabx_nodes_user
        FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_sandlabx_nodes_lab
        FOREIGN KEY (lab_id) REFERENCES sandlabx_labs(id) ON DELETE CASCADE
    );

    -- Adopt partially initialized databases created by historical schema files.
    ALTER TABLE sandlabx_nodes ADD COLUMN IF NOT EXISTS image_metadata JSONB;
    ALTER TABLE sandlabx_nodes ADD COLUMN IF NOT EXISTS user_id UUID;
    ALTER TABLE sandlabx_nodes ADD COLUMN IF NOT EXISTS lab_id UUID;
    ALTER TABLE sandlabx_nodes ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE sandlabx_nodes ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ;
    ALTER TABLE sandlabx_nodes ADD COLUMN IF NOT EXISTS wiped_at TIMESTAMPTZ;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sandlabx_nodes_user'
      ) THEN
        ALTER TABLE sandlabx_nodes
          ADD CONSTRAINT fk_sandlabx_nodes_user
          FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sandlabx_nodes_lab'
      ) THEN
        ALTER TABLE sandlabx_nodes
          ADD CONSTRAINT fk_sandlabx_nodes_lab
          FOREIGN KEY (lab_id) REFERENCES sandlabx_labs(id) ON DELETE CASCADE;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS sandlabx_console_sessions (
      id BIGSERIAL PRIMARY KEY,
      node_id UUID NOT NULL,
      client_ip VARCHAR(45),
      started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMPTZ,
      CONSTRAINT sandlabx_console_sessions_node_id_fkey
        FOREIGN KEY (node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sandlabx_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lab_id UUID NOT NULL,
      source_node_id UUID NOT NULL,
      target_node_id UUID NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'tap',
      source_interface VARCHAR(50),
      target_interface VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sandlabx_connections_lab
        FOREIGN KEY (lab_id) REFERENCES sandlabx_labs(id) ON DELETE CASCADE,
      CONSTRAINT fk_sandlabx_connections_source
        FOREIGN KEY (source_node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE,
      CONSTRAINT fk_sandlabx_connections_target
        FOREIGN KEY (target_node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE,
      CONSTRAINT sandlabx_connections_type_check
        CHECK (type IN ('tap', 'vlan', 'bridge'))
    );

    CREATE OR REPLACE FUNCTION update_sandlabx_labs_modified()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_sandlabx_labs_modtime ON sandlabx_labs;
    CREATE TRIGGER update_sandlabx_labs_modtime
      BEFORE UPDATE ON sandlabx_labs
      FOR EACH ROW EXECUTE FUNCTION update_sandlabx_labs_modified();

    CREATE OR REPLACE FUNCTION update_sandlabx_nodes_modified()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_sandlabx_nodes_modtime ON sandlabx_nodes;
    CREATE TRIGGER update_sandlabx_nodes_modtime
      BEFORE UPDATE ON sandlabx_nodes
      FOR EACH ROW EXECUTE FUNCTION update_sandlabx_nodes_modified();

    CREATE INDEX IF NOT EXISTS idx_sandlabx_users_email
      ON sandlabx_users(email);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_users_role
      ON sandlabx_users(role);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_labs_user_id
      ON sandlabx_labs(user_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_labs_is_public
      ON sandlabx_labs(is_public);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_images_os_type
      ON sandlabx_images(os_type);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_images_user_id
      ON sandlabx_images(user_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_audit_log_user_id
      ON sandlabx_audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_audit_log_action
      ON sandlabx_audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_audit_log_created_at
      ON sandlabx_audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_status
      ON sandlabx_nodes(status);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_created_at
      ON sandlabx_nodes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_user_id
      ON sandlabx_nodes(user_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_lab_id
      ON sandlabx_nodes(lab_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_user_lab_status
      ON sandlabx_nodes(user_id, lab_id, status);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_console_sessions_node_id
      ON sandlabx_console_sessions(node_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_console_sessions_started_at
      ON sandlabx_console_sessions(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_connections_lab_id
      ON sandlabx_connections(lab_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_connections_source_node_id
      ON sandlabx_connections(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_sandlabx_connections_target_node_id
      ON sandlabx_connections(target_node_id);
  `);
};

// Baseline rollback would destroy existing user/lab/VM metadata. It is
// intentionally irreversible. Future incremental migrations should provide a
// down migration whenever rollback can be made data-safe.
exports.down = false;
