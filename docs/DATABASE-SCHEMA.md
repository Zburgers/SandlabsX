# 🗄️ SandlabX Database Schema

Complete reference for the PostgreSQL database schema used by SandlabX.

## Overview

SandlabX uses PostgreSQL 16 with two schemas:
1. **Guacamole Schema** - Apache Guacamole authentication and connection management
2. **SandlabX Schema** - Application-specific tables with `sandlabx_` prefix

```
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
├─────────────────────────────────────────────────────────────────┤
│  Guacamole Schema (managed by Apache Guacamole)                 │
│  ├── guacamole_connection, guacamole_user, etc.                 │
│                                                                  │
│  SandlabX Schema (application tables)                           │
│  ├── sandlabx_users          ─┬─→ sandlabx_labs                 │
│  │                            ├─→ sandlabx_nodes                │
│  │                            ├─→ sandlabx_images               │
│  │                            └─→ sandlabx_audit_log            │
│  ├── sandlabx_labs           ──→ sandlabx_connections           │
│  ├── sandlabx_nodes          ──→ sandlabx_console_sessions      │
│  └── sandlabx_connections                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## SandlabX Tables

### `sandlabx_users`

User accounts with role-based access control.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Primary key |
| `email` | VARCHAR(255) | NOT NULL | - | Unique user email |
| `password_hash` | VARCHAR(255) | NOT NULL | - | bcrypt salted hash |
| `role` | VARCHAR(50) | NOT NULL | `'student'` | `admin`, `instructor`, or `student` |
| `created_at` | TIMESTAMPTZ | - | `CURRENT_TIMESTAMP` | Account creation time |

**Constraints:**
- `PRIMARY KEY (id)`
- `UNIQUE (email)`
- `CHECK (role IN ('admin', 'instructor', 'student'))`

**Indexes:**
- `idx_sandlabx_users_email` ON `(email)`
- `idx_sandlabx_users_role` ON `(role)`

**Example:**
```sql
INSERT INTO sandlabx_users (email, password_hash, role)
VALUES ('admin@sandlabx.io', '$2b$12$...', 'admin');
```

---

### `sandlabx_labs`

Lab templates and topology snapshots.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Primary key |
| `name` | VARCHAR(255) | NOT NULL | - | Lab display name |
| `user_id` | UUID | NOT NULL | - | FK → `sandlabx_users.id` |
| `topology_json` | JSONB | NOT NULL | `'{}'` | Canvas state + nodes + edges |
| `template_name` | VARCHAR(255) | NULL | - | e.g., `'BGP_SETUP'`, `'OSPF_LAB'` |
| `is_public` | BOOLEAN | - | `FALSE` | Whether lab is publicly viewable |
| `created_at` | TIMESTAMPTZ | - | `CURRENT_TIMESTAMP` | Lab creation time |
| `updated_at` | TIMESTAMPTZ | - | `CURRENT_TIMESTAMP` | Last modification (auto-updated) |

**Constraints:**
- `PRIMARY KEY (id)`
- `FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE CASCADE`

**Indexes:**
- `idx_sandlabx_labs_user_id` ON `(user_id)`
- `idx_sandlabx_labs_is_public` ON `(is_public)`

**Example:**
```sql
INSERT INTO sandlabx_labs (name, user_id, topology_json, template_name)
VALUES (
  'BGP Lab - Spring 2025',
  '550e8400-e29b-41d4-a716-446655440000',
  '{"nodes": [{"id": "r1", "position": {"x": 100, "y": 100}}], "edges": []}',
  'BGP_SETUP'
);
```

---

### `sandlabx_nodes`

VM instance metadata and lifecycle tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | - | Primary key |
| `name` | VARCHAR(255) | NOT NULL | - | Node display name |
| `os_type` | VARCHAR(50) | NOT NULL | - | `ubuntu`, `debian`, `cisco-ios`, `custom` |
| `status` | VARCHAR(20) | NOT NULL | `'stopped'` | `stopped`, `starting`, `running`, `stopping`, `error` |
| `overlay_path` | TEXT | NOT NULL | - | Path to QCOW2 overlay |
| `vnc_port` | INTEGER | NULL | - | VNC port when running |
| `guac_connection_id` | INTEGER | NULL | - | Guacamole connection ID |
| `guac_url` | TEXT | NULL | - | Full Guacamole console URL |
| `pid` | INTEGER | NULL | - | QEMU process ID |
| `ram_mb` | INTEGER | NOT NULL | `2048` | Memory in MB |
| `cpu_cores` | INTEGER | NOT NULL | `2` | vCPU count |
| `image_metadata` | JSONB | NULL | - | Additional image info |
| `user_id` | UUID | NULL | - | FK → `sandlabx_users.id` |
| `lab_id` | UUID | NULL | - | FK → `sandlabx_labs.id` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `CURRENT_TIMESTAMP` | Node creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `CURRENT_TIMESTAMP` | Last update (auto-trigger) |
| `started_at` | TIMESTAMPTZ | NULL | - | Last boot time |
| `stopped_at` | TIMESTAMPTZ | NULL | - | Last shutdown time |
| `wiped_at` | TIMESTAMPTZ | NULL | - | Last wipe time |

**Constraints:**
- `PRIMARY KEY (id)`
- `CHECK (status IN ('stopped', 'starting', 'running', 'stopping', 'error'))`
- `FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL`
- `FOREIGN KEY (lab_id) REFERENCES sandlabx_labs(id) ON DELETE CASCADE`

**Indexes:**
- `idx_sandlabx_nodes_status` ON `(status)`
- `idx_sandlabx_nodes_user_id` ON `(user_id)`
- `idx_sandlabx_nodes_lab_id` ON `(lab_id)`
- `idx_sandlabx_nodes_created_at` ON `(created_at DESC)`
- `idx_sandlabx_nodes_user_lab_status` ON `(user_id, lab_id, status)` (composite)

---

### `sandlabx_connections`

Network connections (TAP/VLAN/bridge) between nodes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Primary key |
| `lab_id` | UUID | NOT NULL | - | FK → `sandlabx_labs.id` |
| `source_node_id` | UUID | NOT NULL | - | FK → `sandlabx_nodes.id` |
| `target_node_id` | UUID | NOT NULL | - | FK → `sandlabx_nodes.id` |
| `type` | VARCHAR(50) | - | `'tap'` | `tap`, `vlan`, or `bridge` |
| `source_interface` | VARCHAR(50) | NULL | - | e.g., `'eth0'`, `'Gi0/0'` |
| `target_interface` | VARCHAR(50) | NULL | - | e.g., `'eth1'`, `'ens3'` |
| `created_at` | TIMESTAMPTZ | - | `CURRENT_TIMESTAMP` | Connection creation time |

**Constraints:**
- `PRIMARY KEY (id)`
- `FOREIGN KEY (lab_id) REFERENCES sandlabx_labs(id) ON DELETE CASCADE`
- `FOREIGN KEY (source_node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE`
- `FOREIGN KEY (target_node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE`
- `CHECK (type IN ('tap', 'vlan', 'bridge'))`

**Indexes:**
- `idx_sandlabx_connections_lab_id` ON `(lab_id)`
- `idx_sandlabx_connections_source_node_id` ON `(source_node_id)`
- `idx_sandlabx_connections_target_node_id` ON `(target_node_id)`

**Example:**
```sql
INSERT INTO sandlabx_connections (lab_id, source_node_id, target_node_id, type, source_interface, target_interface)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  'tap',
  'eth0',
  'eth0'
);
```

---

### `sandlabx_images`

Custom VM image registry.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Primary key |
| `name` | VARCHAR(255) | NOT NULL | - | Unique image name |
| `path` | VARCHAR(512) | NOT NULL | - | Filesystem path to QCOW2 |
| `format` | VARCHAR(20) | - | `'qcow2'` | `qcow2`, `raw`, or `vmdk` |
| `size_gb` | DECIMAL(10,2) | NULL | - | Image size in GB |
| `os_type` | VARCHAR(50) | NULL | - | `ubuntu`, `debian`, `cisco`, `custom` |
| `is_valid` | BOOLEAN | - | `TRUE` | Validation status |
| `user_id` | UUID | NULL | - | FK → `sandlabx_users.id` (NULL = system) |
| `created_at` | TIMESTAMPTZ | - | `CURRENT_TIMESTAMP` | Upload time |

**Constraints:**
- `PRIMARY KEY (id)`
- `UNIQUE (name)`
- `FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL`
- `CHECK (format IN ('qcow2', 'raw', 'vmdk'))`

**Indexes:**
- `idx_sandlabx_images_os_type` ON `(os_type)`
- `idx_sandlabx_images_user_id` ON `(user_id)`

**Example:**
```sql
INSERT INTO sandlabx_images (name, path, format, size_gb, os_type)
VALUES ('ubuntu-24-lts', '/images/ubuntu-24-lts.qcow2', 'qcow2', 3.2, 'ubuntu');
```

---

### `sandlabx_audit_log`

Security and compliance logging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | SERIAL | NOT NULL | auto | Primary key |
| `user_id` | UUID | NULL | - | FK → `sandlabx_users.id` |
| `action` | VARCHAR(100) | NOT NULL | - | e.g., `CREATE_NODE`, `START_VM` |
| `resource_type` | VARCHAR(50) | NULL | - | `node`, `lab`, `image` |
| `resource_id` | UUID | NULL | - | UUID of affected resource |
| `details` | JSONB | NULL | - | Full action context |
| `success` | BOOLEAN | - | `TRUE` | Operation outcome |
| `created_at` | TIMESTAMPTZ | - | `CURRENT_TIMESTAMP` | Log timestamp |

**Constraints:**
- `PRIMARY KEY (id)`
- `FOREIGN KEY (user_id) REFERENCES sandlabx_users(id) ON DELETE SET NULL`

**Indexes:**
- `idx_sandlabx_audit_log_user_id` ON `(user_id)`
- `idx_sandlabx_audit_log_action` ON `(action)`
- `idx_sandlabx_audit_log_created_at` ON `(created_at)`

**Logged Actions:**
```
CREATE_NODE, START_VM, STOP_VM, WIPE_VM, DELETE_NODE,
CREATE_LAB, DELETE_LAB, EXPORT_LAB, IMPORT_LAB,
UPLOAD_IMAGE, DELETE_IMAGE, UPDATE_USER, LOGIN, LOGOUT
```

---

### `sandlabx_console_sessions`

Console access session tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | SERIAL | NOT NULL | auto | Primary key |
| `node_id` | UUID | NOT NULL | - | FK → `sandlabx_nodes.id` |
| `client_ip` | VARCHAR(45) | NULL | - | Client IP address |
| `started_at` | TIMESTAMPTZ | NOT NULL | `CURRENT_TIMESTAMP` | Session start |
| `ended_at` | TIMESTAMPTZ | NULL | - | Session end |

**Constraints:**
- `PRIMARY KEY (id)`
- `FOREIGN KEY (node_id) REFERENCES sandlabx_nodes(id) ON DELETE CASCADE`

**Indexes:**
- `idx_sandlabx_console_sessions_node_id` ON `(node_id)`
- `idx_sandlabx_console_sessions_started_at` ON `(started_at DESC)`

---

## Schema Files

| File | Purpose |
|------|---------|
| [initdb-schema.sql](../initdb-schema.sql) | Guacamole schema + SandlabX tables (users, labs, images, audit_log) |
| [backend/schema/nodes-schema.sql](../backend/schema/nodes-schema.sql) | Nodes table + connections + console_sessions |

---

## Common Queries

### Active nodes per user
```sql
SELECT u.email, COUNT(n.id) as active_nodes
FROM sandlabx_users u
LEFT JOIN sandlabx_nodes n ON n.user_id = u.id AND n.status = 'running'
GROUP BY u.id;
```

### Labs with node count
```sql
SELECT l.name, l.template_name, COUNT(n.id) as nodes
FROM sandlabx_labs l
LEFT JOIN sandlabx_nodes n ON n.lab_id = l.id
GROUP BY l.id;
```

### Audit trail for a user
```sql
SELECT action, resource_type, resource_id, success, created_at
FROM sandlabx_audit_log
WHERE user_id = '550e8400-...'
ORDER BY created_at DESC
LIMIT 50;
```

---

**Last Updated:** December 2025  
**Schema Version:** 1.0
