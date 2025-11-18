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
  node_id UUID NOT NULL REFERENCES sandlabx_nodes(id) ON DELETE CASCADE,
  client_ip VARCHAR(45),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT sandlabx_console_sessions_node_id_fkey FOREIGN KEY (node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sandlabx_console_sessions_node_id ON sandlabx_console_sessions(node_id);
CREATE INDEX IF NOT EXISTS idx_sandlabx_console_sessions_started_at ON sandlabx_console_sessions(started_at DESC);
