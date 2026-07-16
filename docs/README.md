# SandLabX documentation

Use this index to find the current operational and development documentation. Files under `docs/archive/` are historical context and may not describe the current implementation.

## Start here

| Document | Purpose |
| --- | --- |
| [Project README](../README.md) | Product overview, architecture, features, and commands |
| [Quick start](../QUICK-START.md) | Host preparation and first startup |
| [Architecture](ARCHITECTURE.md) | Current service boundaries and extraction roadmap |
| [Managed image pipeline](IMAGE-PIPELINE.md) | Import, validation, catalog, compaction, resizing, and ISO planning |
| [Lab Capsules](CAPSULES.md) | Canonical versions, deterministic plans, operations, verification, and checkpoints |
| [Project structure](../STRUCTURE.md) | Repository layout and ownership |

## Active product planning

| Document | Purpose |
| --- | --- |
| [Product architecture ideation](SANDLABX_PRODUCT_ARCHITECTURE_IDEATION_2026-07-17.md) | Product rationale and market/architecture exploration |
| [Lab Capsules and Scenario Engine plan](plans/2026-07-17-lab-capsules-scenario-engine.md) | Validated feature scope, implementation tasks, API/data model, and 1.2.0 release gates |

## Component guides

| Document | Purpose |
| --- | --- |
| [Backend](../backend/README.md) | API, modules, developer CLI, testing, and configuration |
| [Frontend](../frontend/README.md) | Next.js development, structure, and product surfaces |
| [Database schema](DATABASE-SCHEMA.md) | PostgreSQL tables and relationships |
| [Image format guide](IMAGE-FORMAT-GUIDE.md) | Existing image format background |

## Product and historical material

- [Product requirements](sandlab-prd-v1.1.md) — historical context; verify status claims against source and the active plan
- [Archived documents](archive/)

Historical documents are useful for intent and previous decisions, but verify commands and architecture against the root README and current source before relying on them.

## Common workflows

### Start the platform

```bash
cp .env.example .env
make prepare
make doctor
make up
```

### Validate the codebase

```bash
make test
docker compose config --quiet
```

### Manage images

```bash
cd backend
npm run image:doctor
npm run sandlabx -- image pull ubuntu-24.04
npm run sandlabx -- image import /path/to/appliance.vmdk --name appliance
```

### Validate a lab definition

```bash
cd backend
npm run sandlabx -- lab validate ../examples/labs/basic-routing.json
```

## Documentation maintenance

When behavior changes:

1. Update the closest component README.
2. Update the root README when setup, architecture, or user-visible capabilities change.
3. Add operational detail to a focused guide under `docs/`.
4. Move superseded design documents to `docs/archive/` rather than presenting them as current.
5. Keep commands executable and avoid unverified claims about performance, security, or production readiness.
6. Keep one feature or major architecture decision in one Markdown file under `docs/plans/`.

The Capsule feature is implemented on its feature branch and remains a target release until the CI, database, and real-host virtualization gates in the active plan pass. The repository manifests remain `1.0.0`; no release tag is created by this change.
