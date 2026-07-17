# SandLabX quick start

## 1. Prepare the host

SandLabX requires Linux, Docker Compose, KVM, and TUN/TAP networking for full
virtual-machine execution.

```bash
git clone https://github.com/Zburgers/SandlabsX.git
cd SandlabsX
cp .env.example .env
make prepare
make network-audit
make doctor
```

`make network-audit` is read-only. A KVM or TUN warning means the web/API stack
may still start, but VM execution will be unavailable or slower.

## 2. Start SandLabX

After pulling code, changing dependencies, or adding migrations:

```bash
make rebuild
```

For later starts that can reuse existing images:

```bash
make up
```

Startup follows this dependency graph:

```text
PostgreSQL
├── version-matched Guacamole initializer -> Guacamole
└── node-pg-migrate -> backend -> frontend
```

The backend starts only after all pending SandLabX migrations apply and schema
verification succeeds. Existing PostgreSQL volumes are upgraded in place.

```bash
make verify
docker compose ps --all
```

The two one-shot database containers should finish successfully:

- `sandlabx-guacamole-db-init`
- `sandlabx-migrate`

Open the UI at `http://127.0.0.1:3000`.

Other local endpoints:

- API documentation: `http://127.0.0.1:3001/api/docs`
- Guacamole: `http://127.0.0.1:8081/guacamole`
- PostgreSQL: `127.0.0.1:5432`

Published ports bind to loopback by default. Review credentials, CORS, and
firewalling before exposing the stack to a network.

## 3. Database migrations

SandLabX uses `node-pg-migrate`. Application tables are not created through
PostgreSQL first-boot scripts and are not mutated by the API process.

```bash
make db-migrate
make db-check
make db-create-migration NAME=add_example_column
```

Do not remove the PostgreSQL named volume as a troubleshooting step. Migration
failures should be investigated through the one-shot migrator logs.

```bash
docker compose logs --tail=200 migrate guacamole-db-init postgres backend
```

## 4. Temporary legacy VM runtime

Normal startup creates two unnumbered Layer-2 bridges inside the backend
container for the fixed `tap0..tap3` QEMU path.

It does not enable forwarding, assign router IP addresses to infrastructure
bridges, add host routes/NAT rules, or write host QEMU helper files.

This path is marked `LEGACY` and must be removed after the Capsule `LocalRunner`
executes compiled per-instance networks.

## 5. Install a cloud image

```bash
cd backend
npm install --no-audit --no-fund
npm run image:doctor
npm run sandlabx -- image pull ubuntu-24.04
npm run image:list
```

Import a local appliance image:

```bash
npm run sandlabx -- image import /path/to/appliance.vmdk \
  --name appliance \
  --display-name "Lab appliance"
```

Inspect or validate an image:

```bash
npm run sandlabx -- image inspect /path/to/appliance.vmdk
npm run sandlabx -- image validate /path/to/base.qcow2
```

The old fixed-image bootstrap remains explicit only:

```bash
AUTO_DOWNLOAD_IMAGES=false make image-init
```

## 6. Prepare an ISO installation

```bash
npm run sandlabx -- image plan-install /path/to/debian.iso \
  --name debian-desktop \
  --disk-size 32G \
  --cpus 2 \
  --memory 4096 \
  --vnc 5990
```

Plan generation works. Durable automatic installer execution is still pending
integration with the Capsule runner.

## 7. Validate a lab definition

```bash
npm run sandlabx -- lab validate ../examples/labs/basic-routing.json
```

## 8. Operate the stack

```bash
make logs
make ps
make restart
make down
```

Stopping the stack retains PostgreSQL data, managed images, checkpoints, and VM
overlays.

## Troubleshooting

```bash
make network-audit
make doctor
make verify
docker compose ps --all
docker compose logs --tail=200 migrate backend postgres guacamole-db-init guacamole
```

See [Startup and runtime model](docs/STARTUP-RUNTIME.md),
[Database schema](docs/DATABASE-SCHEMA.md), and
[Architecture](docs/ARCHITECTURE.md).
