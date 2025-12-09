-- SandlabX Nodes Database Schema
-- Stores VM/node state in PostgreSQL instead of JSON files

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
  
  -- Resources
  ram_mb INTEGER NOT NULL DEFAULT 2048,
  cpu_cores INTEGER NOT NULL DEFAULT 2,
  
  -- Image metadata (JSON)
  image_metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  stopped_at TIMESTAMP WITH TIME ZONE,
  wiped_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT sandlabx_nodes_status_check CHECK (status IN ('stopped', 'starting', 'running', 'stopping', 'error'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_status ON sandlabx_nodes(status);
CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_created_at ON sandlabx_nodes(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sandlabx_nodes_modtime
  BEFORE UPDATE ON sandlabx_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- Console access logs (optional, for auditing)
CREATE TABLE IF NOT EXISTS sandlabx_console_sessions (
  id SERIAL PRIMARY KEY,
  node_id UUID NOT NULL,
  client_ip VARCHAR(45),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT sandlabx_console_sessions_node_id_fkey 
    FOREIGN KEY (node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sandlabx_console_sessions_node_id ON sandlabx_console_sessions(node_id);
CREATE INDEX IF NOT EXISTS idx_sandlabx_console_sessions_started_at ON sandlabx_console_sessions(started_at DESC);

-- -----------------------------------------------------------------------------
-- Table: sandlabx_connections 
-- Network connections (TAP interfaces, VLANs) between nodes within a lab
-- Note: This must be after nodes table creation and after labs table in initdb
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sandlabx_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL,
  source_node_id UUID NOT NULL,
  target_node_id UUID NOT NULL,
  type VARCHAR(50) DEFAULT 'tap',
  source_interface VARCHAR(50),
  target_interface VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_sandlabx_connections_lab
    FOREIGN KEY (lab_id) REFERENCES sandlabx_labs(id) ON DELETE CASCADE,
  CONSTRAINT fk_sandlabx_connections_source
    FOREIGN KEY (source_node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE,
  CONSTRAINT fk_sandlabx_connections_target
    FOREIGN KEY (target_node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE,
  CONSTRAINT sandlabx_connections_type_check
    CHECK (type IN ('tap', 'vlan', 'bridge'))
);

CREATE INDEX IF NOT EXISTS idx_sandlabx_connections_lab_id ON sandlabx_connections(lab_id);
CREATE INDEX IF NOT EXISTS idx_sandlabx_connections_source_node_id ON sandlabx_connections(source_node_id);
CREATE INDEX IF NOT EXISTS idx_sandlabx_connections_target_node_id ON sandlabx_connections(target_node_id);

-- -----------------------------------------------------------------------------
-- Alter sandlabx_nodes to add FK relationships to users and labs
-- These columns enable multi-tenancy and lab association
-- -----------------------------------------------------------------------------
ALTER TABLE sandlabx_nodes 
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS lab_id UUID;

-- Add FK constraints (using DO block to handle "already exists" gracefully)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sandlabx_nodes_user' 
    AND table_name = 'sandlabx_nodes'
  ) THEN
    ALTER TABLE sandlabx_nodes
      ADD CONSTRAINT fk_sandlabx_nodes_user 
        FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sandlabx_nodes_lab' 
    AND table_name = 'sandlabx_nodes'
  ) THEN
    ALTER TABLE sandlabx_nodes
      ADD CONSTRAINT fk_sandlabx_nodes_lab
        FOREIGN KEY (lab_id) REFERENCES sandlabx_labs(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_user_id ON sandlabx_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_lab_id ON sandlabx_nodes(lab_id);

-- Composite indexes for common query patterns (as specified in PRD)
CREATE INDEX IF NOT EXISTS idx_sandlabx_nodes_user_lab_status 
  ON sandlabx_nodes(user_id, lab_id, status);
