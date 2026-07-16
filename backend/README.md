# SandLabX backend

The backend is an Express service that coordinates authentication, PostgreSQL-backed lab state, QEMU/KVM virtual machines, QCOW2 overlays, and Guacamole console registration. It also includes standalone developer tooling for managed disk images, declarative lab specifications, and versioned Lab Capsules.

## Local development

```bash
cd backend
npm install --no-audit --no-fund
npm run dev
```

The API listens on `http://localhost:3001` by default.

Useful commands:

```bash
npm test                 # Node test runner suites
npm run test:watch       # Re-run tests while editing
npm run check            # Tests and JavaScript syntax checks
npm run image:doctor     # Check local QEMU tools
npm run image:list       # List managed custom images
npm run sandlabx -- help # Developer CLI
```

The full stack is normally started from the repository root with `make up`.

## Module boundaries

```text
backend/
├── cli/
│   └── sandlabx.js              Developer CLI
├── controllers/                 Authentication and user controllers
├── middleware/                  JWT, RBAC, and rate limiting
├── modules/
│   ├── imagePipeline.js         Managed image lifecycle
│   ├── labSpec.js               Declarative lab validation
│   ├── capsuleSchema.js         Canonical Capsule normalization and legacy conversion
│   ├── planCompiler.js           Deterministic network and QEMU plan compiler
│   ├── capsuleRepository.js      Draft and immutable version persistence
│   ├── capsuleRouter.js          Capsule/version/instance HTTP boundary
│   ├── verificationRunner.js     Typed checks with bounded redacted evidence
│   ├── checkpointService.js      Stopped-VM checkpoint copy and restore
│   ├── nodeManagerPostgres.js   Node persistence
│   ├── labManager.js            Lab persistence and access
│   ├── qemuManager.js           VM process and overlay orchestration
│   ├── guacamoleClient.js       Console registration
│   └── auditLogger.js           Audit events
├── schema/                      PostgreSQL schema additions
├── test/                        Regression tests
└── server.js                    Composition root and HTTP routes
```

`server.js` should remain a composition and transport layer. New infrastructure behavior belongs in a module with tests rather than directly inside a route.

## API surface

Public endpoints:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/health`
- `GET /api/docs`

Authenticated endpoint groups:

- `/api/nodes` — node creation and lifecycle
- `/api/images` — image catalog, uploads, and validation
- `/api/labs` — lab persistence and topology data
- `/api/capsules`, `/api/capsule-versions` — canonical definitions, publication, export, and plans
- `/api/instances`, `/api/operations` — immutable-version runtime records and durable action intents
- `/api/users` — user administration

The Swagger UI at `/api/docs` is the canonical endpoint reference.

## Managed images

The image pipeline is deliberately independent from Express so it can be reused by API jobs, CLI workflows, tests, and future workers.

```bash
npm run sandlabx -- image inspect /path/to/disk.vmdk
npm run sandlabx -- image import /path/to/disk.vmdk --name appliance
npm run sandlabx -- image pull ubuntu-24.04
npm run sandlabx -- image compact appliance
npm run sandlabx -- image resize appliance 40G
```

Important guarantees:

- QEMU commands use argument arrays with `shell: false`.
- Imports convert into unique staging files.
- Per-image locks reject concurrent mutation.
- Validation happens before publication.
- Atomic renames prevent partially published images.
- Managed images cannot depend on external backing files.
- Manifests record checksums, source, size, tags, and timestamps.

Browser uploads now delegate to `ImagePipeline.import`, publish only validated managed images, and return an operation record. The CLI and API share the same image transaction behavior.

## Declarative labs

```bash
npm run sandlabx -- lab validate ../examples/labs/basic-routing.json
npm run sandlabx -- lab normalize ../examples/labs/basic-routing.json /tmp/lab.json
```

Validation covers node identifiers, image presence, CPU and memory bounds, link references, interface reuse, self-links, and total resource budgets.

## Lab Capsules

```bash
npm run sandlabx -- capsule validate ../examples/capsules/ospf-failure-recovery/capsule.json --published
npm run sandlabx -- capsule normalize ../examples/capsules/ospf-failure-recovery/capsule.json /tmp/capsule.json
```

See [`docs/CAPSULES.md`](../docs/CAPSULES.md) for the API, operation lifecycle, plan compiler, verification checks, and checkpoint safety contract.

## ISO installation planning

An ISO is installation media, not a directly convertible system disk. Generate a reproducible installation plan:

```bash
npm run sandlabx -- image plan-install /path/to/os.iso \
  --name installed-os \
  --disk-size 32G \
  --cpus 2 \
  --memory 4096 \
  --vnc 5990
```

The result contains a `qemu-img create` plan and a QEMU launch plan. A seed ISO can be attached for unattended installers.

## Configuration

The Compose stack supplies most values. Important variables include:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list |
| `GUAC_BASE_URL` | Guacamole base URL |
| `CUSTOM_IMAGES_PATH` | Managed image directory |
| `IMAGE_CATALOG_PATH` | Curated image catalog |
| `OVERLAYS_PATH` | Per-node QCOW2 overlays |
| `VMS_PATH` | VM storage directory |
| `QEMU_IFUP` / `QEMU_IFDOWN` | TAP network scripts |

Never use the repository’s development defaults on an exposed deployment.

## Testing

```bash
npm test
```

The tooling tests use temporary directories and fake QEMU runners. They verify transaction cleanup and domain behavior without requiring KVM or real disk images.

CI also performs backend syntax checks, frontend compilation, Compose validation, and container builds.

## Architectural work still needed

`qemuManager.js` remains too broad. It should be decomposed behind its current public interface into:

- VM process lifecycle
- disk and snapshot lifecycle
- TAP/bridge networking
- serial console fan-out
- VNC and port allocation

This should be done incrementally so existing node APIs remain stable.

See [Architecture](../docs/ARCHITECTURE.md) and [Managed image pipeline](../docs/IMAGE-PIPELINE.md).
