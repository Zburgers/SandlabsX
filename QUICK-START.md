# SandLabX quick start

## 1. Prepare the host

SandLabX requires a Linux host with Docker Compose, KVM support, and TUN/TAP networking for virtual-machine execution.

```bash
git clone https://github.com/Zburgers/SandlabsX.git
cd SandlabsX
cp .env.example .env
make prepare
make network-audit
make doctor
```

`make network-audit` is read-only. It reports whether old SandLabX bridge names or routes exist in the host namespace and never changes them.

A KVM or TUN warning means the web/API stack may still be inspectable, but VM execution will be unavailable or will fall back to slow TCG where supported.

## 2. Start SandLabX

After pulling code or changing Dockerfiles, rebuild once:

```bash
make rebuild
```

For subsequent starts that can reuse the existing images:

```bash
make up
```

Direct Compose equivalents:

```bash
docker compose up --build
docker compose up -d --build --remove-orphans
```

Check readiness:

```bash
docker compose ps
curl -fsS http://127.0.0.1:3001/api/health
```

Open the web interface at `http://127.0.0.1:3000`.

Other local endpoints:

- API documentation: `http://127.0.0.1:3001/api/docs`
- Guacamole: `http://127.0.0.1:8081/guacamole`
- PostgreSQL: `127.0.0.1:5432`

Published ports bind to loopback by default. Do not change `BIND_ADDRESS` to `0.0.0.0` until credentials, CORS, firewalling, and exposure requirements have been reviewed.

The project currently includes development administrator credentials:

- Email: `admin@sandlabx.com`
- Password: `admin123`

Replace all development credentials and secrets before exposing the stack outside a trusted machine.

## 3. Understand the temporary legacy runtime

Normal startup currently creates two **unnumbered Layer-2 bridges inside the backend container only** to support the old fixed `tap0..tap3` QEMU path.

It does not:

- enable IPv4 forwarding;
- assign `192.168.1.1` or `192.168.2.1` to infrastructure bridges;
- add host routes, NAT, or iptables rules;
- write host `/etc/qemu-ifup` files;
- download or validate every image before the API starts.

This compatibility path is marked `LEGACY` in the executable files and must be removed after the Capsule `LocalRunner` executes compiled per-instance networks.

## 4. Install a cloud image

The curated image catalog can download and convert supported cloud images into managed standalone QCOW2 files.

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

Inspect or validate an image without importing it:

```bash
npm run sandlabx -- image inspect /path/to/appliance.vmdk
npm run sandlabx -- image validate /path/to/base.qcow2
```

The old fixed-image bootstrap is explicit only:

```bash
AUTO_DOWNLOAD_IMAGES=false make image-init
```

Do not use that compatibility command for new image workflows.

## 5. Prepare an ISO installation

ISO files need an installation VM rather than direct disk conversion. Generate a deterministic installation plan:

```bash
npm run sandlabx -- image plan-install /path/to/debian.iso \
  --name debian-desktop \
  --disk-size 32G \
  --cpus 2 \
  --memory 4096 \
  --vnc 5990
```

The command prints the disk-creation and QEMU launch arguments. An optional `--seed /path/to/seed.iso` can attach unattended-installation metadata.

Automatic installer execution is not yet connected to the Capsule runner. Plan generation works; durable background installation, progress, cancellation, and publication remain follow-up work.

## 6. Validate a lab definition

```bash
npm run sandlabx -- lab validate ../examples/labs/basic-routing.json
```

Create a deterministic normalized copy for version control:

```bash
npm run sandlabx -- lab normalize \
  ../examples/labs/basic-routing.json \
  /tmp/basic-routing.normalized.json
```

## 7. Operate the stack

```bash
make logs       # Follow service logs
make ps         # Inspect service state
make restart    # Restart services
make down       # Stop services
```

Stopping the stack retains PostgreSQL data, managed images, checkpoints, and VM overlays. Review disk files explicitly before deleting persistent data.

Historical `run-all.sh`, `setup-all.sh`, `scripts/stop-all.sh`, and `scripts/status.sh` filenames remain as marked legacy aliases. They no longer launch or kill separate host Node/Next processes.

## Troubleshooting

Run the safety/preflight checks again:

```bash
make network-audit
make doctor
```

Inspect health and recent logs:

```bash
docker compose ps
docker compose logs --tail=200 backend postgres guacamole
curl -v http://127.0.0.1:3001/api/health
```

For image-specific failures:

```bash
cd backend
npm run image:doctor
npm run sandlabx -- image inspect /path/to/image
```

See [Startup and runtime model](docs/STARTUP-RUNTIME.md), [Managed image pipeline](docs/IMAGE-PIPELINE.md), and [Architecture](docs/ARCHITECTURE.md) for deeper operational details.
