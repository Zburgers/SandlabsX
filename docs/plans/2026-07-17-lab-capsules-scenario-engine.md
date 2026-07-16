# Lab Capsules and Scenario Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn SandLabX's visual topology, QEMU runtime, image management, console access, and lab validation foundations into one versioned, reproducible, verifiable Lab Capsule workflow.

**Architecture:** A Capsule is the canonical desired-state document. A published Capsule version is immutable and compiles into an execution plan; a lab instance is a separate runtime realization of that version. Express remains an API boundary, PostgreSQL owns durable desired state and operations, and a single-host runner executes idempotent steps while reconciling observed QEMU, disk, network, and console state.

**Tech Stack:** Node.js/Express, PostgreSQL, QEMU/KVM, Apache Guacamole, Next.js/React, Node's built-in test runner, Docker Compose, JSON Schema-compatible validation.

---

## Decision summary

Proceed with **Lab Capsules + Scenario Engine**, delivered as focused increments. The first implementation slice is the canonical model plus a deterministic network-plan compiler. Checkpoints, verification, and scenario authoring follow only after the compiler and recovery contract are proven.

The source rationale is [SANDLABX_PRODUCT_ARCHITECTURE_IDEATION_2026-07-17.md](../SANDLABX_PRODUCT_ARCHITECTURE_IDEATION_2026-07-17.md). This document narrows it to repository-backed decisions, acceptance criteria, and implementation tasks.

### Implementation status on `feat/lab-capsules-scenario-engine`

The implementation includes the Phase 0–5 control-plane slices: canonical schema and legacy conversion, versioned PostgreSQL migrations and repository contracts, deterministic network/QEMU plan compilation, Capsule/version/instance/operation routes, ImagePipeline-backed uploads, typed verification, stopped-VM checkpoints, a reference OSPF Capsule, CLI validation, and a frontend Capsule surface. The host-runner seam is explicit and safe: lifecycle operations fail with a durable `RUNNER_UNAVAILABLE` result until a single-host runner is configured. Real QEMU/KVM provisioning, process adoption, and live network device integration remain release-gate work rather than being represented as complete by this branch.

### Version finding

No release tag or GitHub release is currently published. The checked-out application manifests are `1.0.0`, while the historical PRD is labelled `v1.1` and still describes implemented features as planned. The latest available implementation is open Draft PR #4, `dev/image-pipeline-architecture`, at head `56d1255`; it adds the managed image pipeline, `labSpec.js`, CLI tooling, tests, CI, and documentation, but is not merged into `main`.

**Recommendation:** Treat Draft PR #4 as the prerequisite foundation. Use **SandLabX 1.2.0** as the next product-version target for the first qualified Capsule vertical slice, not as a release claim today. Do not tag `1.2.0` until the release gates below pass.

### Scope boundary

In scope:

- canonical Capsule schema and legacy conversion;
- immutable Capsule versions and runtime instances;
- deterministic topology/network plan compilation;
- persisted resource allocations;
- PostgreSQL-backed operations with row leasing;
- startup reconciliation and safe process ownership;
- structured verification checks, stopped-VM checkpoints, and reset;
- one reference OSPF failure/recovery Capsule;
- Git-friendly export and documentation.

Deferred:

- multi-host scheduling and cross-host networking;
- Kubernetes orchestration, live migration, and high availability;
- arbitrary author scripts as the default check mechanism;
- vendor image distribution;
- AI-generated topology or QEMU commands;
- feature parity with EVE-NG, GNS3, or Cisco Modeling Labs.

## Validation of the ideation

The findings below use the current checkout plus remote Draft PR #4. Prose is not treated as implementation evidence.

| Proposal | Repository evidence | Verdict | Required work |
|---|---|---|---|
| Lab Capsule product abstraction | Current code has labs, nodes, topology JSON, image records, and consoles, but no Capsule entity. | Validated direction | Add definition/version/instance separation. |
| Canonical declarative model | `backend/modules/labManager.js` accepts `nodes[]` and `edges[]`; Draft PR #4 adds `labSpec.js`, but it is not yet a runtime Capsule contract. | Required foundation | Add policy, images, drivers, interfaces, scenarios, and publication. |
| Canvas as a projection | The legacy canvas still stores local presentation state; the new Capsule model separates semantic links from positions. | Partially implemented | Migrate canvas save/export to the Capsule API. |
| Real topology compiler | `planCompiler.js` compiles declared links into deterministic segments, MACs, TAPs, ports, disk actions, and QEMU arg arrays. | Control-plane implemented | Connect the plan to a verified host network/QEMU runner. |
| Managed image pipeline | Browser uploads now call `ImagePipeline.import` and return an operation record. | API converged | Add a background worker for progress events during very large imports. |
| Durable operations | Versioned tables, idempotency, events, cancellation state, and API action intents are present. | Control-plane implemented | Add row leasing and a production runner loop. |
| Restart reconciliation | Startup cleanup kills every live PID found in a PID file; live process ownership is held in an in-memory `Map`. | Required before production claims | Verify identity, persist it, adopt valid resources, and mark drift. |
| Checkpoints and reset | `CheckpointService` stages stopped-node disk copies and verifies SHA-256 on restore. | Control-plane implemented | Persist runner-side disk/runtime coordination. |
| Structured verification | `VerificationRunner` supports topology plans, bounded serial output, and bounded artifact checks. | MVP implemented | Add persisted verification result writes and more trusted probes. |
| Single-host runner | Docker Compose and local QEMU make a single-host runner the natural first deployment. | Validated constraint | Define the runner boundary now; defer remote scheduling. |
| AI copilot | No implementation evidence; AI assistance is already appearing in competing products. | Defer | Consider only after schema validation, planning, and diffing are trustworthy. |

### Repository corrections

- The ideation's managed-image and LabSpec claims describe Draft PR #4, not the old `main` checkout.
- `docs/sandlab-prd-v1.1.md` is historical context, not current release evidence. Its readiness table and “five days to production grade” conclusion conflict with the runtime architecture.
- Both application manifests remain `1.0.0`; no release tags or GitHub releases were found.
- The implementation branch delivers the control-plane and safety contracts described here. It does not claim that real host provisioning, process adoption, or KVM integration have passed until those gates are run on the target Linux host.

## Product contract

### Capsule lifecycle

```text
DRAFT -> VALIDATING -> VALID -> PUBLISHED -> ARCHIVED
                    \-> INVALID
```

Only a published version can create an instance. Editing a draft never mutates a published version or running instance.

### Instance lifecycle

```text
CREATING -> PROVISIONING -> STOPPED -> STARTING -> RUNNING
                                      \-> FAILED
RUNNING -> STOPPING -> STOPPED
RUNNING -> DEGRADED -> RECOVERING | FAILED
STOPPED -> RESETTING -> STOPPED
Any non-terminal state -> DESTROYING -> DESTROYED
```

Every transition is a durable operation and an audit/event record. The API exposes desired state and observed state.

### Capsule contents

The normalized JSON representation includes:

- `apiVersion`, `kind`, metadata, owner, revision, and content hash;
- runtime architecture, acceleration, isolation, resource, and egress policy;
- digest-pinned images and compatibility metadata;
- keyed nodes with driver, resources, explicit interfaces, and console type;
- links with stable IDs, endpoint interface IDs, type, and optional impairment;
- bootstrap references rooted inside the Capsule bundle;
- scenario stages, instructions, checks, checkpoints, and artifact policy;
- trust level and security restrictions.

JSON is the initial API, storage, normalized export, and test-fixture format. YAML authoring can be added later without creating a second semantic model.

### Minimum Capsule example

```json
{
  "apiVersion": "sandlabx.io/v1alpha1",
  "kind": "LabCapsule",
  "metadata": {"name": "basic-routing", "displayName": "Basic routing"},
  "runtime": {"architecture": "x86_64", "acceleration": "preferred", "isolation": "private"},
  "policy": {"resources": {"maxVcpus": 6, "maxMemoryMiB": 6144}, "network": {"internetEgress": false}},
  "images": {"router": {"name": "router", "digest": "sha256:REQUIRED"}},
  "nodes": {
    "r1": {"driver": "qemu-serial-router", "image": "router", "interfaces": [{"id": "ge0"}, {"id": "ge1"}]},
    "r2": {"driver": "qemu-serial-router", "image": "router", "interfaces": [{"id": "ge0"}, {"id": "ge1"}]},
    "client": {"driver": "qemu-linux-cloud", "image": "ubuntu", "interfaces": [{"id": "eth0"}]}
  },
  "links": [
    {"id": "transit", "type": "pointToPoint", "endpoints": ["r1:ge0", "r2:ge0"]},
    {"id": "client-lan", "type": "segment", "endpoints": ["r1:ge1", "client:eth0"]}
  ]
}
```

Published versions must resolve image names to immutable digests before instantiation.

## Target architecture

```text
Next.js editor/runs/console
          |
Express API: auth, policy, validation, queries, SSE mapping
          |
Control plane: registry, compiler, admission, operations, events,
               checkpoints, verification, artifacts
          |
PostgreSQL desired state, versions, allocations, operations, results
          |
Single-host runner/reconciliation loop
          |
QEMU process | disk | network | console | image | verification services
```

The API must not allocate TAP devices, spawn QEMU, mutate disks, or coordinate partial multi-node deployment directly. These actions belong behind application services and the runner boundary. This is an incremental extraction seam around the existing managers, not a rewrite mandate.

### Compiler output

The compiler accepts a normalized published version, driver capabilities, host capabilities, policy, and instance ID. It returns an immutable plan containing image digests, resource reservations, disk actions, logical interfaces, MACs, segments, host bridges, TAPs, console configuration, QEMU argument arrays, readiness probes, compensation actions, and a stable plan hash.

Initial link types: `pointToPoint`, `segment`, and `nat`. VLAN trunks, external connectors, impairments, and cross-host links are future capabilities.

### Driver contract

Define an internal driver interface before adding more workload conditionals:

```text
validate(node, image, hostCapabilities)
resolveCapabilities(node, image)
compileDiskActions(node, image, instance)
compileNetworkInterfaces(node, allocation)
compileConsole(node)
compileProcess(node, plan)
probeReadiness(node)
collectArtifacts(node)
```

Initial drivers: `qemu-linux-cloud`, `qemu-generic`, and `qemu-serial-router`.

## Data and operation model

### Tables

Add versioned migrations while keeping legacy lab records readable and convertible:

- `capsules`: mutable draft, owner, revision, timestamps;
- `capsule_versions`: immutable normalized document, schema version, hash, publication metadata;
- `lab_instances`: Capsule version, owner, desired/observed state, runner, expiry, reconciliation, failure detail;
- `instance_nodes`: logical node, driver, state, verified process identity, overlay, console;
- `instance_interfaces`: logical interface, MAC, TAP, segment, allocation state, ownership;
- `network_segments`: instance-owned bridge/segment resources and teardown state;
- `operations` and `operation_steps`: intent, idempotency, leases, attempts, progress, results, errors, compensation;
- `instance_events`: append-only progress stream correlated to audit logs;
- `checkpoints`: stopped-node disk manifests, parent, state, digest;
- `verification_runs` and `verification_results`: exact check definition, evidence, outcome, version, instance;
- `artifacts`: type, storage path, digest, size, retention, redaction, instance owner.

Use one shared PostgreSQL pool and explicit transactions for publication, admission, allocation, and state changes. Add optimistic concurrency to drafts with a revision number.

### Operation contract

```text
QUEUED -> PLANNING -> RESERVED -> EXECUTING -> SUCCEEDED
                         |             |
                         v             v
                      FAILED       CANCELLING -> CANCELLED
```

The first runner may use PostgreSQL `FOR UPDATE SKIP LOCKED` row leasing. Redis is not required for the first single-host implementation. Expensive and destructive API requests require an idempotency key.

### Reconciliation contract

At startup and periodically, the runner must load non-terminal instances, inspect only owned resources, verify PID identity against executable/arguments/instance/node, inspect overlays/TAPs/bridges/ports/console registrations, adopt valid resources, resume safe steps, and mark drift. It must never kill a process solely because a PID file exists.

## Delivery plan

### Phase 0: Canonical model

**Files:** `backend/modules/capsuleSchema.js`, `backend/modules/capsuleNormalizer.js`, `backend/test/capsuleSchema.test.js`, `backend/test/fixtures/capsules/basic-routing.json`, and the PR #4 `backend/modules/labSpec.js` compatibility adapter.

Implement schema validation, deterministic normalization, path-specific warnings, stable hashing, and a legacy converter from `nodes[]`/`edges[]` topology JSON. Acceptance: stable fixture output; invalid endpoints and missing digests fail before planning; legacy import never silently invents runtime topology.

### Phase 1: Versions and instances

**Files:** versioned SQL migrations, `backend/modules/capsuleRepository.js`, `instanceRepository.js`, `operationRepository.js`, repository tests, and `docs/DATABASE-SCHEMA.md`.

Implement publication in one transaction, exact-version instance creation, legacy conversion status, rollback tests, and duplicate idempotency-key behavior. Acceptance: drafts cannot mutate published versions; every runtime record points to a version and owner.

### Phase 2: Network-plan compiler

**Files:** `backend/modules/planCompiler.js`, `networkAllocator.js`, `driverRegistry.js`, `backend/test/planCompiler.test.js`, and `backend/modules/qemuManager.js`.

Resolve endpoint interfaces, allocate instance-owned segments/TAPs/MACs/VNC ports transactionally, generate stable QEMU arg arrays, remove `PC1`/`PC2` and fixed `tap0`–`tap3` behavior from the Capsule path, and add partial-allocation compensation. Acceptance: changing a link changes the plan; display names do not affect networking; no allocation duplicates; failed compilation leaves no live host resource.

### Phase 3: Durable operations and reconciliation

**Files:** `operationService.js`, `localRunner.js`, `reconciliationService.js`, `backend/test/operations.test.js`, and API routes in `backend/server.js`.

Return `202` plus an operation ID, add stable step keys, row leases, persisted events, safe cancellation, startup adoption, failure injection, and SSE after event ordering is correct. Acceptance: restart produces adoption or a structured retryable failure; refresh does not lose progress; cancellation leaves no unowned resource.

### Phase 4: Image API convergence

**Files:** `backend/server.js`, PR #4 `backend/modules/imagePipeline.js`, `backend/test/image-api.test.js`, `frontend/lib/api.ts`, and `CreateNodeModal.tsx`.

Route every browser upload through `ImagePipeline`, quarantine and validate before publication, return an operation ID, clean partial artifacts, and show progress/retryability. Acceptance: API and CLI share one image behavior and no route calls legacy conversion directly.

### Phase 5: Verification and checkpoints

**Files:** `verificationRunner.js`, `checkpointService.js`, `backend/test/verification.test.js`, `examples/capsules/ospf-failure-recovery/`, and the instance UI.

Implement typed checks with timeouts/output limits/redaction, stopped-VM disk checkpoints, digest-verified restore, and an OSPF reference Capsule with instructions, serial logs, checks, and topology-plan artifacts. Acceptance: the reference lab can fail a check, be repaired, pass, and reset; arbitrary scripts remain disabled by default.

## API contract for the vertical slice

```http
POST   /api/capsules
GET    /api/capsules
GET    /api/capsules/:capsuleId
PATCH  /api/capsules/:capsuleId
POST   /api/capsules/:capsuleId/validate
POST   /api/capsules/:capsuleId/publish
GET    /api/capsules/:capsuleId/versions
GET    /api/capsule-versions/:versionId
GET    /api/capsule-versions/:versionId/export
POST   /api/capsule-versions/:versionId/plan
POST   /api/instances
GET    /api/instances/:instanceId
POST   /api/instances/:instanceId/actions/start
POST   /api/instances/:instanceId/actions/stop
POST   /api/instances/:instanceId/actions/reset
DELETE /api/instances/:instanceId
GET    /api/operations/:operationId
POST   /api/operations/:operationId/cancel
GET    /api/operations/:operationId/events
GET    /api/instances/:instanceId/events
POST   /api/instances/:instanceId/verifications
GET    /api/instances/:instanceId/verifications
POST   /api/instances/:instanceId/checkpoints
GET    /api/instances/:instanceId/checkpoints
POST   /api/instances/:instanceId/checkpoints/:checkpointId/restore
```

Use SSE for one-way progress and WebSockets for interactive serial console traffic. Expensive/destructive endpoints return `202 Accepted` when asynchronous and require an idempotency key.

## Release gates for 1.2.0

- one canonical schema is used by editor, storage, validation, planning, runtime, and export;
- a three-node reference Capsule produces an equivalent plan twice;
- declared links, not names or fixed TAPs, determine wiring;
- published images are digest-pinned and compatibility-checked;
- API uploads and CLI imports share the managed pipeline;
- long-running work is durable, idempotent, safely cancellable, and visible after refresh;
- backend restart during provisioning is recovered by adoption or a retryable failure;
- every runtime resource has instance ownership and cleanup evidence;
- the reference Capsule reaches consoles, runs a typed check, collects evidence, and resets;
- unsafe scripts, proprietary redistribution, cross-instance console access, and unrestricted egress are blocked by default;
- backend tests, syntax checks, frontend build, Compose validation, and real-host integration tests pass;
- unsupported host/image combinations fail during plan/admission rather than halfway through launch.

## Branch and documentation policy

Recommended implementation branches after the prerequisite foundation:

1. `feat/capsule-domain-model`
2. `feat/capsule-network-compiler`
3. `feat/durable-lab-operations`
4. `fix/unify-image-pipeline-api`
5. `feat/scenario-verification-mvp`

Keep the source ideation as rationale and this file as the active feature plan. Keep active plans in `docs/plans/`, and move superseded operational notes to `docs/archive/`. This feature branch does not tag a release; it is a reviewable implementation increment.
