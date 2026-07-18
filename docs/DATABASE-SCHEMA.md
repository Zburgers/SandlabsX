# SandLabX database schema

SandLabX uses PostgreSQL 16 for both application state and Apache Guacamole.
The two domains share a database instance but have separate ownership rules.

## Ownership boundaries

### Guacamole objects

Objects prefixed with `guacamole_`, along with Guacamole enum types, are owned by
Apache Guacamole. `docker/guacamole-db-init/Dockerfile` uses a multi-stage build
to copy the PostgreSQL schema from the pinned Guacamole image into a PostgreSQL
16 client image. The one-shot `guacamole-db-init` service:

- initializes a database where Guacamole objects are entirely absent;
- no-ops when the expected vendor schema already exists;
- fails when it detects a partial vendor schema;
- never creates or alters SandLabX application tables.

The runtime Guacamole image, guacd image, and schema source share the same
`GUACAMOLE_VERSION` value. Version changes require an explicit review of the
vendor database upgrade path.

### SandLabX objects

Objects prefixed with `sandlabx_` are owned exclusively by versioned migrations
under `backend/migrations/` and tracked in `public.sandlabx_migrations`.

The backend API does not create or alter schema during startup. Compose runs the
one-shot `migrate` service first and starts the API only after migration and
schema verification succeed.

## Migration framework

SandLabX uses `node-pg-migrate` with:

- ordered index-based migration names;
- PostgreSQL advisory locking;
- migration-order validation;
- one transaction for all pending migrations;
- an authoritative `sandlabx_migrations` ledger;
- guarded rollback commands.

```bash
make db-migrate
make db-check
make db-create-migration NAME=add_example_column
```

The initial baseline migrations are intentionally irreversible because dropping
them would destroy existing users, labs, images, VM metadata, and Capsule state.
New incremental migrations should define a safe rollback whenever possible.

## Core application tables

### `sandlabx_users`

Application accounts and roles.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `email` | Unique login identifier |
| `password_hash` | Password hash |
| `role` | `admin`, `instructor`, or `student` |
| `created_at` | Creation timestamp |

### `sandlabx_labs`

Legacy lab/topology documents owned by users.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `name` | Lab display name |
| `user_id` | Owner FK |
| `topology_json` | Persisted legacy topology document |
| `template_name` | Optional template identifier |
| `is_public` | Sharing flag |
| `created_at`, `updated_at` | Lifecycle timestamps |

### `sandlabx_nodes`

Legacy VM instance metadata.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `name`, `os_type` | Identity and image/runtime type |
| `status` | VM lifecycle state |
| `overlay_path` | Writable QCOW2 overlay |
| `vnc_port`, `guac_connection_id`, `guac_url` | Console integration |
| `pid` | Legacy QEMU process ID |
| `ram_mb`, `cpu_cores` | Allocated resources |
| `image_metadata` | Image selection metadata |
| `user_id`, `lab_id` | Ownership and lab association |
| lifecycle timestamps | Creation, update, start, stop, wipe |

### `sandlabx_connections`

Legacy topology links between nodes. This remains a compatibility table until
compiled Capsule network plans become the runtime authority.

### `sandlabx_console_sessions`

Audit records for console access to legacy nodes.

### `sandlabx_images`

Application-level image registry metadata. Managed image manifests and files
remain on disk under the image pipeline's storage roots.

### `sandlabx_audit_log`

Security and operational audit events for state-changing actions.

## Capsule control-plane tables

### Definition and versioning

- `sandlabx_capsules`
- `sandlabx_capsule_versions`

Capsules hold mutable drafts; published versions are immutable normalized
artifacts identified by version number and content digest.

### Runtime state

- `sandlabx_lab_instances`
- `sandlabx_operations`
- `sandlabx_operation_steps`
- `sandlabx_instance_events`

These tables model desired state, operation idempotency, progress, leases,
step-level results, and append-style instance events.

### Verification and artifacts

- `sandlabx_verification_runs`
- `sandlabx_checkpoints`
- `sandlabx_artifacts`

PostgreSQL stores durable ownership, status, manifests, and digests. Large image,
overlay, checkpoint, and artifact contents remain in filesystem-backed storage.

## Current migration files

| Migration | Purpose |
|---|---|
| `0001_core_schema.cjs` | Adopts or creates all core SandLabX tables safely |
| `0002_capsule_control_plane.cjs` | Adopts or creates Capsule control-plane tables |
| `0003_retire_legacy_migration_ledger.cjs` | Removes the obsolete custom migration ledger |

## Retired schema sources

These paths no longer exist and must not be restored:

- `backend/schema/nodes-schema.sql`
- `backend/migrations/001_lab_capsules.sql`
- `docs/archive/initdb-schema.sql`
- SandLabX mounts under `/docker-entrypoint-initdb.d`
- runtime-mounted Guacamole schema exporters and shared init volumes
- the custom `sandlabx_schema_migrations` ledger

PostgreSQL init scripts only execute against a new empty data directory. They are
therefore unsuitable for application upgrades and were the reason existing
volumes could start without `sandlabx_nodes`.

## Operational checks

```bash
# Apply pending migrations in a one-shot container.
make db-migrate

# Verify the migration ledger and all required tables.
make db-check

# Verify the full running stack, including one-shot job exit codes.
make verify
```

The migration service is safe to rerun. With no pending migrations it acquires
the lock, confirms the ledger, and exits without changing application data.

**Last updated:** July 2026  
**Migration framework:** node-pg-migrate 8.0.4
