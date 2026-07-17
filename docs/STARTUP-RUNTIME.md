# SandLabX startup and runtime model

## Supported startup commands

```bash
# Fast path: reuse existing backend/frontend images.
make up

# Rebuild application images after pulling code changes.
make rebuild

# Equivalent direct Compose command for the first test of this branch.
docker compose up --build

# Detached direct Compose command.
docker compose up -d --build --remove-orphans
```

`make up` intentionally does not rebuild on every invocation. Use `make rebuild`
when Dockerfiles, application dependencies, or copied source files changed.

The canonical shell implementation is `scripts/stack.sh`. Historical scripts
such as `run-all.sh`, `setup-all.sh`, `scripts/stop-all.sh`, and
`scripts/status.sh` are explicitly marked **LEGACY** and delegate to the
Compose-only stack controller.

## What normal startup does

1. Starts PostgreSQL and waits for `pg_isready`.
2. Starts guacd and Guacamole.
3. Starts the backend after PostgreSQL is healthy.
4. Runs versioned backend migrations.
5. Creates two unnumbered Layer-2 bridges **inside the backend container only**
   for the legacy fixed `tap0..tap3` runtime.
6. Starts the frontend after the backend health endpoint is ready.

Published development ports bind to `127.0.0.1` by default.

## What normal startup no longer does

- It does not set host or container `net.ipv4.ip_forward`.
- It does not add IP addresses to lab bridges.
- It does not add routes, NAT, or iptables rules.
- It does not modify `/etc/qemu-ifup` or `/etc/qemu-ifdown` at runtime.
- It does not scan every possible QCOW2 image before the API starts.
- It does not download base images during normal startup.
- It does not launch duplicate host backend/frontend processes with `nohup`.
- It does not use broad `pkill` patterns during shutdown.
- It does not require `privileged: true` or `SYS_ADMIN`.

## Legacy compatibility boundary

The backend still contains the old `QemuManager` runtime. It assumes a fixed
router/PC topology and uses `tap0..tap3`. The following files exist only to keep
that path usable during migration:

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

- PostgreSQL, backend API, frontend, guacd, and Guacamole startup.
- Backend migrations and API health checks.
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
bash scripts/network-audit.sh
```

It reports legacy bridge names, routes involving `192.168.1.0/24` or
`192.168.2.0/24`, forwarding state, and Docker networks. It never changes the
host.

If old host bridges exist, do not delete them automatically. First verify their
owner and whether another VM, VPN, container platform, or lab process uses them.

## Recommended test sequence

```bash
git switch perf/safe-compose-startup
cp -n .env.example .env
bash scripts/network-audit.sh
make doctor
make rebuild
docker compose ps
docker compose logs --tail=200 backend
curl -fsS http://127.0.0.1:3001/api/health
```

Then test one existing legacy VM, one router lab, a Guacamole console, and one
managed image operation. Do not test production workloads on this branch until
those checks pass on the target Linux/KVM host.
