# SandLabX quick start

## 1. Prepare the host

SandLabX requires a Linux host with Docker Compose, KVM support, and TUN/TAP networking.

```bash
git clone https://github.com/Zburgers/SandlabsX.git
cd SandlabsX
cp .env.example .env
make prepare
make doctor
```

Resolve failed doctor checks before starting the stack. A KVM warning is not fatal, but virtual machines will use much slower software emulation.

## 2. Start SandLabX

```bash
make up
docker compose ps
curl http://localhost:3001/api/health
```

Open the web interface at `http://localhost:3000`.

Other local endpoints:

- API documentation: `http://localhost:3001/api/docs`
- Guacamole: `http://localhost:8081/guacamole`
- PostgreSQL: `localhost:5432`

The project currently includes development administrator credentials:

- Email: `admin@sandlabx.com`
- Password: `admin123`

Replace all development credentials and secrets before exposing the stack outside a trusted machine.

## 3. Install a cloud image

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

## 4. Prepare an ISO installation

ISO files need an installation VM rather than direct disk conversion. Generate a deterministic installation plan:

```bash
npm run sandlabx -- image plan-install /path/to/debian.iso \
  --name debian-desktop \
  --disk-size 32G \
  --cpus 2 \
  --memory 4096 \
  --vnc 5990
```

The command prints the exact disk-creation and QEMU launch arguments. An optional `--seed /path/to/seed.iso` can attach unattended-installation metadata.

## 5. Validate a lab definition

```bash
npm run sandlabx -- lab validate ../examples/labs/basic-routing.json
```

Create a deterministic normalized copy for version control:

```bash
npm run sandlabx -- lab normalize \
  ../examples/labs/basic-routing.json \
  /tmp/basic-routing.normalized.json
```

## 6. Operate the stack

```bash
make logs       # Follow service logs
make ps         # Inspect service state
make restart    # Restart services
make down       # Stop services
```

Stopping the stack retains PostgreSQL data, managed images, and VM overlays. Review disk files explicitly before deleting persistent data.

## Troubleshooting

Run the preflight again:

```bash
make doctor
```

Inspect health and recent logs:

```bash
docker compose ps
docker compose logs --tail=200 backend postgres guacamole
curl -v http://localhost:3001/api/health
```

For image-specific failures:

```bash
cd backend
npm run image:doctor
npm run sandlabx -- image inspect /path/to/image
```

See [Managed image pipeline](docs/IMAGE-PIPELINE.md) and [Architecture](docs/ARCHITECTURE.md) for deeper operational details.
