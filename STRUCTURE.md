# SandLabX project structure

## Repository layout

```text
SandlabsX/
├── .github/workflows/
│   └── ci.yml                    Backend, frontend, Compose, and Docker checks
├── backend/
│   ├── cli/
│   │   └── sandlabx.js           Image and lab developer CLI
│   ├── controllers/              Authentication and user controllers
│   ├── middleware/               JWT, RBAC, rate limits, and errors
│   ├── modules/
│   │   ├── imagePipeline.js      Transactional managed image lifecycle
│   │   ├── labSpec.js            Lab validation and installer planning
│   │   ├── qemuManager.js        Existing VM orchestration
│   │   ├── nodeManagerPostgres.js
│   │   ├── labManager.js
│   │   ├── guacamoleClient.js
│   │   └── auditLogger.js
│   ├── schema/                   PostgreSQL schema additions
│   ├── test/                     Node test runner suites
│   ├── Dockerfile
│   ├── package.json
│   ├── README.md
│   └── server.js                 Express composition root
├── frontend/
│   ├── app/                      Next.js routes and layouts
│   ├── components/               Dashboard, canvas, modal, and console UI
│   ├── hooks/                    Client state and lifecycle hooks
│   ├── lib/                      API client and shared types
│   ├── public/                   Static assets
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── IMAGE-PIPELINE.md
│   ├── DATABASE-SCHEMA.md
│   ├── IMAGE-FORMAT-GUIDE.md
│   ├── README.md
│   └── archive/                  Historical documentation
├── examples/labs/
│   └── basic-routing.json        Declarative topology example
├── images/
│   ├── catalog.json              Curated downloadable images
│   └── custom/                   Managed custom QCOW2 images
├── overlays/                     Per-node copy-on-write disks
├── scripts/
│   └── dev-doctor.sh             Host virtualization preflight
├── vms/                          VM runtime storage
├── .env.example                  Runtime configuration template
├── AGENTS.md                     Contributor and agent operating guide
├── CONTRIBUTING.md               Development workflow
├── docker-compose.yml            Local stack orchestration
├── initdb-schema.sql             Guacamole database initialization
├── Makefile                      Common developer commands
├── QUICK-START.md
└── README.md
```

## Ownership boundaries

| Area | Responsibility |
| --- | --- |
| `backend/server.js` | HTTP composition, middleware, and route registration |
| `backend/controllers/` | Request-to-domain adaptation |
| `backend/modules/` | Business and infrastructure services |
| `backend/cli/` | Non-HTTP developer and operational workflows |
| `backend/test/` | Isolated domain and tooling regression coverage |
| `frontend/lib/` | Typed transport and shared client contracts |
| `frontend/components/` | Reusable user-interface behavior |
| `images/` | Immutable base images and managed appliance metadata |
| `overlays/` | Disposable or resettable VM write layers |
| `docs/` | Current focused guides and archived historical context |

## Runtime data

The following paths are intentionally not committed:

- Downloaded and converted disk images
- QCOW2 overlays
- VM runtime data
- PostgreSQL volume data
- process IDs and logs
- local environment files

`images/catalog.json`, examples, documentation, schemas, and source code remain version controlled.

## Architectural direction

The backend is currently a modular monolith. That is intentional: VM lifecycle operations need strong local coordination and do not benefit from premature network-service boundaries. Internal modules should become more cohesive before considering separate processes.

The largest remaining extraction target is `qemuManager.js`, which should be decomposed internally into process, disk, network, and console services while preserving its public interface.
