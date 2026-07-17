# SandLabX startup and runtime model

## Supported startup commands

```bash
# Fast path: reuse existing backend/frontend images.
make up

# Rebuild application images, apply migrations, and start.
make rebuild

# Verify one-shot jobs, schema, services, and network invariants.
make verify
```

`make up` intentionally does not rebuild on every invocation. Use `make rebuild`
when Dockerfiles, application dependencies, migrations, or copied source files
change.

The canonical shell implementation is `scripts/stack.sh`. Historical scripts
such as `run-all.sh`, `setup-all.sh`, `scripts/stop-all.sh`, and
`scripts/status.sh` are explicitly marked **LEGACY** and delegate to the
Compose-only stack controller.

## Startup dependency graph

```text
PostgreSQL healthy
├── version-matched Guacamole DB initializer -> Guacamole
└── SandLabX migrator -> backend health -> frontend
```

Normal startup performs these steps:

1. Starts PostgreSQL and waits for `pg_isready`.
2. Builds a small PostgreSQL initializer image that copies vendor schema files
   from the same pinned Guacamole image used at runtime.
3. Applies that vendor schema only when Guacamole tables are entirely absent.
   A partial Guacamole schema is treated as an error and is never auto-repaired.
4. Runs all pending SandLabX migrations through `node-pg-migrate` under a
   PostgreSQL advisory lock and one transaction.
5. Verifies the migration ledger and every required `sandlabx_*` table.
6. Starts the backend only after the migration service exits successfully.
7. Creates two unnumbered Layer-2 bridges inside the backend container for the
   legacy fixed `tap0..tap3` VM runtime.
8. Starts the frontend after the backend health endpoint is ready.

Published development ports bind to `127.0.0.1` by default.

## Database ownership

### Guacamole vendor schema

Guacamole owns its own tables and types. `docker/guacamole-db-init/Dockerfile`
uses a multi-stage build to copy the PostgreSQL schema from the pinned
`guacamole/guacamole` image into a PostgreSQL 16 client image. The one-shot
`guacamole-db-init` service applies it idempotently.

`GUACAMOLE_VERSION` controls the Guacamole web image, guacd image, and schema
initializer source together. A version upgrade must review Guacamole's database
upgrade requirements before changing this value.

SandLabX migrations must never create, alter, or drop `guacamole_*` objects.

### SandLabX application schema

`backend/migrations/*.cjs` is the only authoritative source for application
schema changes. Migration state is stored in `public.sandlabx_migrations`.

The initial migration set is:

- `0001_core_schema.cjs`: users, labs, images, audit records, nodes, console
  sessions, and legacy topology connections.
- `0002_capsule_control_plane.cjs`: Capsules, versions, instances, operations,
  events, verification runs, checkpoints, and artifacts.
- `0003_retire_legacy_migration_ledger.cjs`: removes the retired custom ledger.

The baseline migrations are intentionally irreversible because rolling them
back would destroy existing user, lab, image, VM, and Capsule metadata. New
incremental migrations should provide a safe `down` implementation where
possible.

Useful commands:

```bash
make db-migrate
make db-check
make db-create-migration NAME=add_example_column
```

Migration rollback is guarded and requires an explicit environment opt-in. Do
not run it against shared or production data without reviewing the migration.

## Retired database bootstrap systems

The following paths are removed and must not be restored:

- SandLabX SQL mounted into `/docker-entrypoint-initdb.d`.
- `backend/schema/nodes-schema.sql`.
- `backend/migrations/001_lab_capsules.sql`.
- The combined `docs/archive/initdb-schema.sql` file.
- Runtime-mounted Guacamole schema exporter scripts and timing-sensitive shared
  initialization volumes.
- The custom SQL-directory scanner and `sandlabx_schema_migrations` ledger.
- API startup creating or altering database tables.

PostgreSQL init scripts only run for a brand-new data volume and therefore
cannot serve as an application upgrade mechanism. All upgrades now pass through
the migration service, including upgrades of existing volumes.

## What normal startup no longer does

- It does not mutate application schema from the API process.
- It does not rely on first-boot PostgreSQL init scripts for SandLabX tables.
- It does not copy vendor schema files through runtime-mounted shell scripts.
- It does not set host or container `net.ipv4.ip_forward`.
- It does not add IP addresses to lab bridges.
- It does not add routes, NAT, or iptables rules.
- It does not modify `/etc/qemu-ifup` or `/etc/qemu-ifdown` at runtime.
- It does not scan every possible QCOW2 image before the API starts.
- It does not download base images during normal startup.
- It does not launch duplicate host backend/frontend processes with `nohup`.
- It does not use broad `pkill` patterns during shutdown.
- It does not require `privileged: true` or `SYS_ADMIN`.

## Legacy virtualization compatibility boundary

The backend still contains the old `QemuManager` runtime. It assumes a fixed
router/PC topology and uses `tap0..tap3`. The following files and privileges
exist only to keep that path usable during migration:

- `backend/setup-network.sh`
- `backend/qemu-ifup`
- `backend/qemu-ifdown`
- the `NET_ADMIN`, `/dev/kvm`, and `/dev/net/tun` grants in Compose
- `SANDLABX_NETWORK_MODE=legacy-l2`

Do not extend these files for new topology features.

Remove them when:

1. `LocalRunner` executes compiled Capsule plans.
2. Per-instance bridge/TAP creation is implemented in `QemuNetworkService`.
3. Legacy `/api/nodes` and `/api/labs` starts no longer infer networking from
   node names or fixed TAP identifiers.
4. The API and virtualization runner are separate privilege boundaries.

## Current feature behavior

### Expected to work

- Existing PostgreSQL volumes are upgraded without deleting data.
- Fresh databases receive both version-matched Guacamole schema and all
  SandLabX migrations.
- PostgreSQL, backend API, frontend, guacd, and Guacamole startup.
- Existing fixed two-segment legacy router lab, provided KVM/TUN access and its
  required images are present.
- Existing managed QCOW2 image commands.
- Capsule validation, versioning, deterministic plan compilation, verification,
  and checkpoint control-plane APIs.
- Explicit legacy image validation through `make image-init`.

### Expected limitations

- The Capsule control plane still reports `RUNNER_UNAVAILABLE` for real host
  execution because the new runner boundary is not wired to QEMU/network actions.
- Arbitrary visual topology links are not yet authoritative for the legacy VM
  runtime; fixed TAP behavior remains until the runner migration.
- Automatic ISO installation execution is not wired into the runtime. ISO
  installer planning works, but installation still needs a runner/job workflow.
- Hosts without `/dev/kvm` or `/dev/net/tun` may fail to create the backend
  container with the current full-runtime Compose file. A future API-only base
  Compose plus optional runner profile should remove this coupling.
- Existing Guacamole connection rows may reference old runtime assumptions and
  should be tested with a newly created VM connection.

## Safe host review

Run the read-only audit before or after testing:

```bash
make network-audit
```

It reports legacy bridge names, routes involving `192.168.1.0/24` or
`192.168.2.0/24`, forwarding state, and Docker networks. It never changes the
host.

If old host bridges exist, do not delete them automatically. First verify their
owner and whether another VM, VPN, container platform, or lab process uses them.

## Recommended test sequence

```bash
git switch perf/safe-compose-startup
git pull --ff-only
cp -n .env.example .env
make network-audit
make doctor
make rebuild
make verify
docker compose logs --tail=200 migrate backend postgres guacamole-db-init
```

Then test one existing legacy VM, one router lab, a Guacamole console, and one
managed image operation. Do not merge until these checks pass on the target
Linux/KVM host.
