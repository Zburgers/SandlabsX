# Capsule Platform Replacement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace SandLabX's legacy lab, standalone-node, topology, networking, and runtime paths with one observable, recoverable Capsule platform for isolated QEMU/KVM educational labs.

**Architecture:** Keep a modular monolith with an Express API process and a PostgreSQL-leased single-host runner process. Canonical immutable Capsule revisions compile into persisted execution plans; all host mutations happen through capability-driven disk, network, QEMU, and console ports, with durable operations, ownership-safe reconciliation, and a hard legacy cutover after real-KVM qualification.

**Tech Stack:** Node.js 20, Express, PostgreSQL 16, node-pg-migrate, QEMU/KVM, QCOW2, Linux TAP/bridge networking, Apache Guacamole, Next.js 15, React 19, React Flow, Pino, Node's built-in test runner, Docker Compose.

---

## Rules for executing this plan

- Read `docs/plans/2026-07-18-capsule-platform-architecture-design.md`, `README.md`, `backend/README.md`, and the closest component README before each major slice.
- Work only in the dedicated Capsule worktree and branch. Refresh from `origin/main` before implementation and resolve the branch's deleted-upstream state explicitly.
- Use TDD: add a focused failing test, verify the expected failure, implement the smallest coherent behavior, rerun focused tests, then run the slice gate.
- Never add new behavior to `LabManager`, `nodeManagerPostgres`, the legacy `/api/labs` or `/api/nodes` routes, or legacy topology shapes.
- Temporary adapters must be named `legacy*Adapter`, documented in the replacement ledger, and introduced with an explicit deletion task.
- Use one injected PostgreSQL pool. Do not create pools inside managers or repositories.
- Use argument arrays with `shell: false`; never interpolate authored values into command strings.
- Every mutating resource records ownership and has idempotent observation and compensation.
- Every new component emits structured correlated operational events and durable audit or operation events where applicable.
- Do not claim production readiness. Record which real-KVM, recovery, security, backup, and operational gates have actually passed.

## Task 1: Create the legacy replacement ledger and architecture guardrails

**Files:**
- Create: `docs/plans/capsule-legacy-replacement-ledger.md`
- Create: `backend/scripts/check-architecture.js`
- Create: `backend/test/architecture.test.js`
- Modify: `backend/package.json`
- Modify: `docs/README.md`

**Step 1: Inventory every legacy surface**

Record exact routes, modules, tables, frontend paths, topology fields, scripts, tests, and docs involving:

```text
LabManager
nodeManagerPostgres
qemuManager.js and qemuManager.js.backup
/api/labs
/api/nodes
sandlabx_labs
sandlabx_nodes
sandlabx_connections
sandlabx_console_sessions
frontend/app/lab
nodes[] + edges[] legacy topology
fixed TAP, MAC, PC1, or PC2 behavior
```

For each row include classification (`retain`, `port`, `replace`, `delete`), target component, temporary adapter if any, target task, and deletion evidence.

**Step 2: Write a failing architecture test**

Add a test that runs the checker and initially expects it to report current legacy imports and direct `console.*` use without failing the whole migration phase:

```js
test('architecture checker inventories legacy runtime dependencies', () => {
  const report = checkArchitecture({ root, mode: 'inventory' });
  assert.ok(report.legacyImports.some(item => item.includes('labManager')));
  assert.ok(report.directConsole.length > 0);
});
```

**Step 3: Run the focused test**

Run: `cd backend && node --test test/architecture.test.js`  
Expected: FAIL because `check-architecture.js` does not exist.

**Step 4: Implement inventory and enforcement modes**

Use `rg`-equivalent filesystem traversal in Node. `inventory` reports debt; `enforce` exits non-zero for forbidden imports, route registrations, topology keys, backup files, direct `console.*`, or shell-string process execution. Keep allowlists explicit and temporary.

**Step 5: Add package commands**

Add:

```json
"architecture:inventory": "node scripts/check-architecture.js inventory",
"architecture:check": "node scripts/check-architecture.js enforce"
```

Do not add `architecture:check` to the global gate until Task 18 removes the allowlist.

**Step 6: Verify and commit**

Run: `cd backend && node --test test/architecture.test.js && npm run architecture:inventory`  
Expected: PASS and a deterministic debt report matching the ledger.

```bash
git add docs/plans/capsule-legacy-replacement-ledger.md docs/README.md backend/scripts/check-architecture.js backend/test/architecture.test.js backend/package.json
git commit -m "test: inventory capsule replacement debt"
```

## Task 2: Centralize database and observability foundations

**Files:**
- Create: `backend/platform/database.js`
- Create: `backend/platform/observability.js`
- Create: `backend/platform/errors.js`
- Create: `backend/platform/auditRepository.js`
- Create: `backend/middleware/requestContext.js`
- Create: `backend/test/observability.test.js`
- Create: `backend/test/database.test.js`
- Modify: `backend/logger.js`
- Modify: `backend/server.js`
- Modify: `backend/package.json`

**Step 1: Write failing redaction and correlation tests**

Cover recursive redaction, bounded fields, stable error mapping, request ID propagation, and operation context:

```js
test('redacts secrets recursively without losing correlation fields', () => {
  const event = sanitize({ requestId: 'req-1', authorization: 'Bearer secret', nested: { password: 'x' } });
  assert.equal(event.requestId, 'req-1');
  assert.equal(event.authorization, '[REDACTED]');
  assert.equal(event.nested.password, '[REDACTED]');
});
```

**Step 2: Run focused tests**

Run: `cd backend && node --test test/observability.test.js test/database.test.js`  
Expected: FAIL because platform modules do not exist.

**Step 3: Implement one pool and transaction helper**

Export `createDatabase`, `withTransaction`, `healthcheck`, and `close`. Require repository constructors to receive the pool or transaction client.

**Step 4: Implement structured observability**

Provide child logger context for request, operation, instance, node, user, runner, step, and attempt IDs. Separate operational logging from durable audit and user-visible operation events. Preserve internal causes while returning stable safe errors.

**Step 5: Add request context middleware**

Accept a valid `X-Request-Id` or generate one, set it on the response, attach a child logger, and propagate it into submitted operations.

**Step 6: Replace composition-root logger and pool creation**

Update `server.js` to create one database and one root observability context. Do not migrate legacy managers yet; temporary constructor adapters may receive the shared pool in Task 3.

**Step 7: Extend tests**

Test audit insert shape, safe error responses, no full request-body logging, log-level configuration, and bounded subprocess stderr metadata.

**Step 8: Verify and commit**

Run: `cd backend && node --test test/observability.test.js test/database.test.js && node -c server.js`  
Expected: PASS.

```bash
git add backend/platform backend/middleware/requestContext.js backend/test/observability.test.js backend/test/database.test.js backend/logger.js backend/server.js backend/package.json
git commit -m "feat: centralize database and observability"
```

## Task 3: Define canonical Capsule, Scenario, and workload contracts

**Files:**
- Create: `backend/domain/capsule.js`
- Create: `backend/domain/scenario.js`
- Create: `backend/domain/workloadProfile.js`
- Create: `backend/domain/stateMachines.js`
- Create: `backend/domain/identifiers.js`
- Create: `backend/test/capsule-domain.test.js`
- Create: `backend/test/scenario-domain.test.js`
- Create: `backend/test/workload-profile.test.js`
- Modify: `backend/modules/capsuleSchema.js`
- Modify: `examples/capsules/ospf-failure-recovery/capsule.json`

**Step 1: Write failing canonical-model tests**

Cover stable IDs, exact image/profile version references, disks, interfaces, point-to-point and shared segments, presentation metadata exclusion from semantic hash, isolated-network policy, and no embedded Scenarios.

**Step 2: Write failing compatibility tests**

Require Scenario versions to reference exact Capsule versions initially. Validate every node, interface, checkpoint, check target, and artifact reference at publication.

**Step 3: Write failing workload-capability tests**

Validate architecture, machine, firmware, disks, NIC limits/models, console, bootstrap, readiness, capture, checkpoint, and hot-plug declarations without OS-type conditionals.

**Step 4: Run focused tests**

Run: `cd backend && node --test test/capsule-domain.test.js test/scenario-domain.test.js test/workload-profile.test.js`  
Expected: FAIL on missing domain modules.

**Step 5: Implement pure domain modules**

Keep normalization, hashing, validation, and state transitions deterministic and independent of Express, PostgreSQL, filesystems, and QEMU.

**Step 6: Convert `capsuleSchema.js` into a temporary compatibility facade**

Re-export the new domain implementation so existing Capsule tests continue to pass. Add it to the deletion ledger for Task 18.

**Step 7: Remove embedded `scenarios` from the Capsule fixture**

Create Scenario fixtures under `backend/test/fixtures/scenarios/` and update the OSPF example to reference documentation for its separate Scenario.

**Step 8: Verify and commit**

Run: `cd backend && node --test test/capsule-domain.test.js test/scenario-domain.test.js test/workload-profile.test.js test/capsuleSchema.test.js`  
Expected: PASS.

```bash
git add backend/domain backend/modules/capsuleSchema.js backend/test examples/capsules/ospf-failure-recovery/capsule.json
git commit -m "feat: define canonical capsule contracts"
```

## Task 4: Replace the control-plane schema with final versioned tables

**Files:**
- Create: `backend/migrations/0004_capsule_platform_schema.cjs`
- Create: `backend/migrations/0005_capsule_platform_constraints.cjs`
- Modify: `backend/scripts/check-schema.js`
- Modify: `backend/scripts/test-legacy-upgrade.js`
- Create: `backend/test/migrations-capsule-platform.test.js`
- Modify: `docs/DATABASE-SCHEMA.md`
- Modify: `backend/package.json`

**Step 1: Write migration contract tests**

Use a disposable PostgreSQL database. Assert all approved authoring, runtime, operation, allocation, Scenario, assignment, artifact, checkpoint, and audit tables, constraints, indexes, and foreign keys exist.

**Step 2: Run the focused migration test**

Run: `cd backend && node --test test/migrations-capsule-platform.test.js`  
Expected: FAIL because the final schema is absent.

**Step 3: Add additive schema migrations**

Do not drop legacy tables yet. Add final tables and migrate prototype Capsule records only if present and structurally valid. Private and published versions must be immutable by database trigger or permission-enforced write path.

**Step 4: Add ownership and uniqueness constraints**

Require durable ownership for runtime resources, unique live allocations, operation idempotency scope, ordered events, version digests, and exact assignment version references.

**Step 5: Update schema verification**

Make `db:check` verify final tables and constraints while marking legacy tables as pending deletion.

**Step 6: Test fresh and upgrade paths**

Run: `cd backend && npm run db:test-legacy-upgrade && node --test test/migrations-capsule-platform.test.js`  
Expected: PASS without deleting existing rows.

**Step 7: Verify and commit**

Run: `cd backend && npm run check`  
Expected: PASS after adding migrations to the syntax-check list.

```bash
git add backend/migrations/0004_capsule_platform_schema.cjs backend/migrations/0005_capsule_platform_constraints.cjs backend/scripts backend/test/migrations-capsule-platform.test.js backend/package.json docs/DATABASE-SCHEMA.md
git commit -m "feat(db): add capsule platform schema"
```

## Task 5: Implement repositories and transactional application services

**Files:**
- Create: `backend/repositories/capsuleRepository.js`
- Create: `backend/repositories/scenarioRepository.js`
- Create: `backend/repositories/instanceRepository.js`
- Create: `backend/repositories/operationRepository.js`
- Create: `backend/repositories/allocationRepository.js`
- Create: `backend/repositories/assignmentRepository.js`
- Create: `backend/services/capsuleService.js`
- Create: `backend/services/scenarioService.js`
- Create: `backend/services/assignmentService.js`
- Create: `backend/test/capsule-service.test.js`
- Create: `backend/test/scenario-service.test.js`
- Create: `backend/test/assignment-service.test.js`

**Step 1: Write failing service tests**

Cover optimistic draft updates, private revisions, publication immutability, duplicate digest handling, authorization, exact Scenario compatibility, assignment pinning, and transaction rollback.

**Step 2: Run focused tests**

Run: `cd backend && node --test test/capsule-service.test.js test/scenario-service.test.js test/assignment-service.test.js`  
Expected: FAIL because services and repositories are missing.

**Step 3: Implement repositories with injected clients**

No repository creates its own pool. Methods that participate in publication, assignment, or instance creation accept a transaction client.

**Step 4: Implement Capsule private-run behavior**

`createPrivateRevision` validates and freezes a draft without marking it published. It returns the immutable revision used by test instances.

**Step 5: Implement Scenario publication**

Validate every reference against the pinned Capsule version and reject moving `latest` references.

**Step 6: Implement assignments and capabilities**

Model admin, instructor, student, owner, assignee, and explicit instructor-observer capabilities in application services.

**Step 7: Verify and commit**

Run: `cd backend && node --test test/capsule-service.test.js test/scenario-service.test.js test/assignment-service.test.js`  
Expected: PASS.

```bash
git add backend/repositories backend/services backend/test/capsule-service.test.js backend/test/scenario-service.test.js backend/test/assignment-service.test.js
git commit -m "feat: add capsule application services"
```

## Task 6: Version image artifacts and workload profiles

**Files:**
- Create: `backend/services/imageArtifactService.js`
- Create: `backend/services/workloadProfileService.js`
- Create: `backend/repositories/imageArtifactRepository.js`
- Create: `backend/repositories/workloadProfileRepository.js`
- Create: `backend/test/image-artifact-service.test.js`
- Create: `backend/test/workload-profile-service.test.js`
- Modify: `backend/modules/imagePipeline.js`
- Modify: `backend/cli/sandlabx.js`
- Modify: `docs/IMAGE-PIPELINE.md`

**Step 1: Write failing artifact tests**

Cover staging, inspection, conversion, backing-chain rejection, digest identity, provenance, atomic publication, duplicate content, capture from a stopped owned overlay, and cleanup after failure.

**Step 2: Write failing profile tests**

Cover immutable profile versions, compatible image metadata, allowed node overrides, and unsupported hardware combinations.

**Step 3: Run focused tests**

Run: `cd backend && node --test test/image-artifact-service.test.js test/workload-profile-service.test.js`  
Expected: FAIL.

**Step 4: Wrap the existing safe image pipeline**

Retain its transaction mechanics while moving metadata ownership and version publication into the new service and repository.

**Step 5: Add explicit capture workflow**

Require stopped instance, owned overlay, capacity quota, new immutable digest, provenance linking source instance/node, and no mutation of the original image.

**Step 6: Update CLI**

Add profile list/inspect/validate and image-version inspect commands. CLI and API must call the same services.

**Step 7: Verify and commit**

Run: `cd backend && node --test test/image-artifact-service.test.js test/workload-profile-service.test.js test/tooling.test.js`  
Expected: PASS.

```bash
git add backend/services backend/repositories backend/test backend/modules/imagePipeline.js backend/cli/sandlabx.js docs/IMAGE-PIPELINE.md
git commit -m "feat: version images and workload profiles"
```

## Task 7: Replace the prototype compiler with deterministic planning and admission

**Files:**
- Create: `backend/planning/planCompiler.js`
- Create: `backend/planning/networkPlanner.js`
- Create: `backend/planning/diskPlanner.js`
- Create: `backend/planning/consolePlanner.js`
- Create: `backend/services/admissionService.js`
- Create: `backend/repositories/reservationRepository.js`
- Create: `backend/test/plan-compiler-v2.test.js`
- Create: `backend/test/admission-service.test.js`
- Modify: `backend/modules/planCompiler.js`
- Modify: `backend/modules/networkAllocator.js`

**Step 1: Write failing compiler tests**

Cover point-to-point and shared segments, unwired NICs, semantic hash stability, presentation-only changes, exact image/profile versions, argument arrays, collision-safe bounded host names, no implicit wiring, and no OS/display-name conditionals.

**Step 2: Write failing admission tests**

Cover strict no-overcommit CPU/memory, storage quotas, concurrent reservation, stopped-resource release, unsupported host capabilities, and deterministic failure codes.

**Step 3: Run focused tests**

Run: `cd backend && node --test test/plan-compiler-v2.test.js test/admission-service.test.js`  
Expected: FAIL.

**Step 4: Implement a pure compiler**

The compiler has no filesystem, process, network, database, or clock side effects. Persist the resulting plan and hashes before reservation or execution.

**Step 5: Implement transactional reservations**

Use row locks or exclusion constraints so concurrent starts cannot reserve the same capacity, port, MAC, TAP name, or segment identity.

**Step 6: Convert old modules to temporary facades**

`modules/planCompiler.js` may re-export the new compiler. Remove or facade `networkAllocator.js`, and mark both for Task 18 deletion.

**Step 7: Verify and commit**

Run: `cd backend && node --test test/plan-compiler-v2.test.js test/admission-service.test.js test/planCompiler.test.js`  
Expected: PASS.

```bash
git add backend/planning backend/services/admissionService.js backend/repositories/reservationRepository.js backend/test backend/modules/planCompiler.js backend/modules/networkAllocator.js
git commit -m "feat: compile and admit capsule plans"
```

## Task 8: Extract disk, network, process, and console host ports

**Files:**
- Create: `backend/runtime/processRunner.js`
- Create: `backend/runtime/diskService.js`
- Create: `backend/runtime/networkService.js`
- Create: `backend/runtime/qemuProcessService.js`
- Create: `backend/runtime/consoleService.js`
- Create: `backend/runtime/ownership.js`
- Create: `backend/test/runtime-disk.test.js`
- Create: `backend/test/runtime-network.test.js`
- Create: `backend/test/runtime-qemu.test.js`
- Create: `backend/test/runtime-console.test.js`
- Modify: `backend/modules/qemuManager.js`
- Modify: `backend/modules/guacamoleClient.js`

**Step 1: Write failing fake-adapter tests**

Test staged overlays, atomic publication, path containment, TAP/segment create-observe-delete, link state, process identity, readiness, graceful stop, force-stop policy, console registration, token scope, and reverse cleanup.

**Step 2: Run focused tests**

Run: `cd backend && node --test test/runtime-disk.test.js test/runtime-network.test.js test/runtime-qemu.test.js test/runtime-console.test.js`  
Expected: FAIL.

**Step 3: Implement one safe process runner**

Accept executable plus argument array, always set `shell: false`, bound output, propagate correlation, redact metadata, and return structured exit evidence.

**Step 4: Implement owned host services**

Every create/delete method requires ownership identity. Observation is side-effect free. Deletion refuses unknown or mismatched resources.

**Step 5: Adapt proven legacy behavior**

Refactor `qemuManager.js` and `guacamoleClient.js` behind the new ports without exposing their broad public interfaces to new code. Do not port fixed TAP, MAC, node-name, or startup-cleanup behavior.

**Step 6: Verify shell safety**

Run: `rg -n "exec\(|shell:\s*true|PC1|PC2|tap[0-9]" backend --glob '*.js'`  
Expected: no new runtime matches; every remaining legacy match is listed in the ledger.

**Step 7: Verify and commit**

Run: `cd backend && node --test test/runtime-*.test.js`  
Expected: PASS.

```bash
git add backend/runtime backend/test/runtime-*.test.js backend/modules/qemuManager.js backend/modules/guacamoleClient.js
git commit -m "refactor: extract capsule runtime services"
```

## Task 9: Implement durable operations, runner leasing, and reconciliation

**Files:**
- Create: `backend/services/operationService.js`
- Create: `backend/runner/runner.js`
- Create: `backend/runner/operationHandlers.js`
- Create: `backend/runner/reconciliationService.js`
- Create: `backend/runner/main.js`
- Create: `backend/test/operation-service.test.js`
- Create: `backend/test/runner.test.js`
- Create: `backend/test/reconciliation.test.js`
- Modify: `backend/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `backend/package.json`

**Step 1: Write failing operation tests**

Cover idempotency, leases, stable step keys, retries, cancellation boundaries, progress order, compensation, and safe error classification.

**Step 2: Write failing reconciliation tests**

Cover valid process adoption, PID reuse, mismatched arguments, missing overlay, orphaned owned TAP, unowned resource refusal, expired lease recovery, and desired/observed drift.

**Step 3: Run focused tests**

Run: `cd backend && node --test test/operation-service.test.js test/runner.test.js test/reconciliation.test.js`  
Expected: FAIL.

**Step 4: Implement PostgreSQL leasing**

Use `FOR UPDATE SKIP LOCKED`, lease expiry, bounded attempts, and one runner identity. Keep handlers idempotent and persist observations before transitions.

**Step 5: Implement lifecycle handlers**

Add plan, provision, start, stop, link-state, checkpoint, restore, reset, capture, and destroy handlers. Each uses the host ports and emits operational, audit, and instance events.

**Step 6: Add a separate Compose runner service**

The API and runner use the same image but distinct commands. Only the runner receives required QEMU/network device access. Keep privileged mode opt-in and document exact capabilities.

**Step 7: Verify restart behavior with fakes**

Stop a runner during each injected step, start a new runner identity, and assert adoption, retry, or structured terminal failure with no duplicate resource.

**Step 8: Verify and commit**

Run: `cd backend && node --test test/operation-service.test.js test/runner.test.js test/reconciliation.test.js && cd .. && docker compose config --quiet`  
Expected: PASS.

```bash
git add backend/services/operationService.js backend/runner backend/test/operation-service.test.js backend/test/runner.test.js backend/test/reconciliation.test.js backend/Dockerfile backend/package.json docker-compose.yml
git commit -m "feat: add durable capsule runner"
```

## Task 10: Implement checkpoints, reset, capture, and destructive safeguards

**Files:**
- Create: `backend/services/checkpointService.js`
- Create: `backend/services/destructiveActionService.js`
- Create: `backend/test/checkpoint-service-v2.test.js`
- Create: `backend/test/destructive-actions.test.js`
- Modify: `backend/modules/checkpointService.js`
- Modify: `backend/runner/operationHandlers.js`

**Step 1: Write failing checkpoint tests**

Cover stopped-state requirement, multi-node manifest, staged copy, SHA-256, restore digest verification, ownership, partial failure cleanup, quota, and idempotency.

**Step 2: Write failing destructive-action tests**

Require expected instance name, impact token, current revision/state, authorization, and idempotency. Reject stale confirmations.

**Step 3: Run focused tests**

Run: `cd backend && node --test test/checkpoint-service-v2.test.js test/destructive-actions.test.js`  
Expected: FAIL.

**Step 4: Implement services and operation integration**

Reset restores initial overlays; restore uses a named checkpoint; destroy removes only verified owned runtime data; capture publishes a new image version through Task 6.

**Step 5: Convert old checkpoint module to facade**

Retain only compatibility exports required before router cutover and add deletion to the ledger.

**Step 6: Verify and commit**

Run: `cd backend && node --test test/checkpoint-service-v2.test.js test/destructive-actions.test.js test/verification.test.js`  
Expected: PASS.

```bash
git add backend/services backend/runner/operationHandlers.js backend/modules/checkpointService.js backend/test/checkpoint-service-v2.test.js backend/test/destructive-actions.test.js
git commit -m "feat: safeguard capsule state operations"
```

## Task 11: Implement Scenario verification and assignments

**Files:**
- Create: `backend/verification/checkRegistry.js`
- Create: `backend/verification/typedChecks.js`
- Create: `backend/verification/guestCommandCheck.js`
- Create: `backend/verification/evidenceService.js`
- Create: `backend/services/verificationService.js`
- Create: `backend/test/typed-checks.test.js`
- Create: `backend/test/guest-command-check.test.js`
- Create: `backend/test/scenario-run.test.js`
- Modify: `backend/modules/verificationRunner.js`
- Create: `examples/scenarios/ospf-failure-recovery/scenario.json`
- Create: `examples/scenarios/ospf-failure-recovery/README.md`

**Step 1: Write failing typed-check tests**

Cover node readiness, authored topology, interface/link state, ping, service port, bounded serial output, artifact content, retry, timeout, scoring, hints, and evidence redaction.

**Step 2: Write failing guest-command tests**

Require instructor authorship, explicit target VM, qualified transport, argument array, no shell, limits, isolated instance ownership, bounded output, and audit events.

**Step 3: Run focused tests**

Run: `cd backend && node --test test/typed-checks.test.js test/guest-command-check.test.js test/scenario-run.test.js`  
Expected: FAIL.

**Step 4: Implement check registry and evidence service**

Plugins are selected from administrator-installed code only. Scenario documents cannot provide executable host code or module paths.

**Step 5: Separate the OSPF Scenario from its Capsule**

Pin the Capsule version fixture, define educational stages and checks, and document expected isolated behavior without requiring a proprietary image.

**Step 6: Verify and commit**

Run: `cd backend && node --test test/typed-checks.test.js test/guest-command-check.test.js test/scenario-run.test.js`  
Expected: PASS.

```bash
git add backend/verification backend/services/verificationService.js backend/modules/verificationRunner.js backend/test examples/scenarios
git commit -m "feat: add versioned scenario verification"
```

## Task 12: Replace the HTTP API with thin versioned routers

**Files:**
- Create: `backend/routes/capsules.js`
- Create: `backend/routes/scenarios.js`
- Create: `backend/routes/instances.js`
- Create: `backend/routes/operations.js`
- Create: `backend/routes/images.js`
- Create: `backend/routes/assignments.js`
- Create: `backend/routes/console.js`
- Create: `backend/routes/events.js`
- Create: `backend/app.js`
- Create: `backend/test/capsule-api-v2.test.js`
- Create: `backend/test/instance-api.test.js`
- Create: `backend/test/authorization-api.test.js`
- Modify: `backend/server.js`
- Modify: `backend/swagger.js`

**Step 1: Write failing API contract tests**

Cover drafts, optimistic updates, validate, private run, publish, versions, plan preview, instance lifecycle intents, link state, checkpoints, reset impact/confirmation, Scenarios, assignments, console grants, operation events, safe errors, and idempotency headers.

**Step 2: Run focused tests**

Run: `cd backend && node --test test/capsule-api-v2.test.js test/instance-api.test.js test/authorization-api.test.js`  
Expected: FAIL.

**Step 3: Create a testable app composition root**

`app.js` accepts services and middleware dependencies. `server.js` creates production dependencies, starts the HTTP server, and handles shutdown.

**Step 4: Implement thin routers**

Routers validate transport shape, call application services, map stable errors, and return `202` for asynchronous mutations. They contain no direct SQL, filesystem, QEMU, TAP, or Guacamole behavior.

**Step 5: Add live events**

Use SSE for operation/instance/editor progress and WebSockets only for interactive console transport. Preserve event order and resume cursors.

**Step 6: Remove prototype Capsule router registration**

Stop registering `modules/capsuleRouter.js`; keep the file only until Task 18 proves no imports remain.

**Step 7: Verify and commit**

Run: `cd backend && node --test test/capsule-api-v2.test.js test/instance-api.test.js test/authorization-api.test.js && node -c app.js && node -c server.js`  
Expected: PASS.

```bash
git add backend/routes backend/app.js backend/server.js backend/swagger.js backend/test/capsule-api-v2.test.js backend/test/instance-api.test.js backend/test/authorization-api.test.js
git commit -m "feat(api): expose capsule platform services"
```

## Task 13: Build the canonical frontend data layer and dashboard

**Files:**
- Create: `frontend/lib/capsule-api.ts`
- Create: `frontend/lib/capsule-types.ts`
- Create: `frontend/lib/event-stream.ts`
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/components/capsules/CapsuleList.tsx`
- Create: `frontend/components/instances/InstanceList.tsx`
- Create: `frontend/components/operations/OperationStatus.tsx`
- Create: `frontend/components/capacity/CapacitySummary.tsx`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/app/page.tsx`

**Step 1: Add a frontend test harness**

Add Vitest and React Testing Library or the repository-approved equivalent. Add `test` and `test:watch` scripts.

**Step 2: Write failing client and dashboard tests**

Cover safe error codes, correlation IDs, event resumption, drafts, instances, assignments, capacity, and operation failures.

**Step 3: Run focused tests**

Run: `cd frontend && npm test -- capsule-api dashboard`  
Expected: FAIL.

**Step 4: Implement the typed client and dashboard**

Do not reuse legacy node/lab response types. Keep desired and observed state separate in TypeScript.

**Step 5: Verify and commit**

Run: `cd frontend && npm test && npm run build`  
Expected: PASS.

```bash
git add frontend/package.json frontend/package-lock.json frontend/lib frontend/app/dashboard frontend/components frontend/app/page.tsx
git commit -m "feat(frontend): add capsule dashboard"
```

## Task 14: Build the visual Capsule editor

**Files:**
- Create: `frontend/app/capsules/[capsuleId]/edit/page.tsx`
- Create: `frontend/components/editor/CapsuleEditor.tsx`
- Create: `frontend/components/editor/NodePalette.tsx`
- Create: `frontend/components/editor/NodeInspector.tsx`
- Create: `frontend/components/editor/InterfaceHandle.tsx`
- Create: `frontend/components/editor/NetworkSegmentNode.tsx`
- Create: `frontend/components/editor/ValidationPanel.tsx`
- Create: `frontend/components/editor/RevisionConflictDialog.tsx`
- Create: `frontend/components/editor/__tests__/CapsuleEditor.test.tsx`
- Modify: `frontend/app/capsules/page.tsx`
- Modify: `frontend/lib/topologyUtils.ts`

**Step 1: Write failing editor tests**

Cover blank canvas, node placement, profile interfaces, explicit interface wiring, shared segments, unwired nodes, stopped-state edit restrictions, autosave revision, conflict recovery, validation-path highlighting, and no topology persistence in local storage.

**Step 2: Run focused tests**

Run: `cd frontend && npm test -- CapsuleEditor`  
Expected: FAIL.

**Step 3: Implement canonical React Flow projection**

React Flow nodes and edges are derived from and write back to the Capsule draft. Preserve stable semantic IDs; positions are presentation metadata only.

**Step 4: Add multi-client draft events**

Apply backend revision events, show conflicts, and never silently overwrite a newer draft.

**Step 5: Replace the JSON-only Capsule page**

Keep JSON import/export as an advanced view, not the primary authoring workflow.

**Step 6: Verify and commit**

Run: `cd frontend && npm test -- CapsuleEditor && npm run build`  
Expected: PASS.

```bash
git add frontend/app/capsules frontend/components/editor frontend/lib/topologyUtils.ts
git commit -m "feat(frontend): build canonical capsule editor"
```

## Task 15: Build runtime, console, Scenario, and destructive-action UX

**Files:**
- Create: `frontend/app/instances/[instanceId]/page.tsx`
- Create: `frontend/app/scenarios/[scenarioId]/page.tsx`
- Create: `frontend/app/assignments/page.tsx`
- Create: `frontend/components/runtime/RuntimeTopology.tsx`
- Create: `frontend/components/runtime/NodeControls.tsx`
- Create: `frontend/components/runtime/ConsoleLauncher.tsx`
- Create: `frontend/components/runtime/CheckpointPanel.tsx`
- Create: `frontend/components/runtime/DestructiveActionDialog.tsx`
- Create: `frontend/components/scenarios/ScenarioRunner.tsx`
- Create: `frontend/components/runtime/__tests__/DestructiveActionDialog.test.tsx`
- Create: `frontend/components/runtime/__tests__/RuntimeTopology.test.tsx`

**Step 1: Write failing runtime UX tests**

Cover desired/observed state, operation timeline, console authorization, link up/down, stopped-node rewiring guidance, checkpoints, typed reset/destroy confirmation, stale impact token rejection, Scenario progress, and instructor-access visibility.

**Step 2: Run focused tests**

Run: `cd frontend && npm test -- RuntimeTopology DestructiveActionDialog ScenarioRunner`  
Expected: FAIL.

**Step 3: Implement run mode**

Display authored wiring separately from observed link and node state. Never infer successful provisioning merely from desired state.

**Step 4: Implement console launch**

Request a short-lived scoped grant immediately before opening serial or VNC transport. Do not place persistent console credentials in URLs or browser storage.

**Step 5: Implement destructive flows**

Fetch server impact preview, require typed instance name, submit impact token plus idempotency key, and display durable operation progress.

**Step 6: Verify and commit**

Run: `cd frontend && npm test && npm run build`  
Expected: PASS.

```bash
git add frontend/app/instances frontend/app/scenarios frontend/app/assignments frontend/components/runtime frontend/components/scenarios
git commit -m "feat(frontend): add capsule runtime workflows"
```

## Task 16: Qualify the full runtime on a real KVM host

**Files:**
- Create: `backend/test/integration/capsule-kvm.test.js`
- Create: `scripts/qualify-capsule-runtime.sh`
- Create: `docs/runbooks/CAPSULE-RUNTIME-QUALIFICATION.md`
- Create: `examples/capsules/qualification-three-node/capsule.json`
- Create: `examples/scenarios/qualification-three-node/scenario.json`
- Modify: `Makefile`
- Modify: `.github/workflows/ci.yml`

**Step 1: Add a guarded real-host test suite**

Skip with a precise reason when `/dev/kvm`, `/dev/net/tun`, QEMU, bridge tooling, images, or required permissions are unavailable. Do not silently pass missing prerequisites.

**Step 2: Add deterministic qualification fixtures**

Use legally distributable lightweight images or an operator-provided fixture manifest. Include two routed nodes and one endpoint with explicit interfaces and private segments.

**Step 3: Prove the happy path**

Validate authored wiring, Layer 2 traffic, routed traffic after guest configuration, serial and VNC access, stop/start persistence, checkpoint/restore, reset, and destroy.

**Step 4: Prove isolation**

Assert no default route or packet path to the host LAN, internet, another instance, or unauthorized host ports.

**Step 5: Prove failure recovery**

Inject failure after overlay, TAP, segment, process, readiness, and console steps. Restart the runner during provisioning and verify adoption/retry/terminal classification without leaked resources.

**Step 6: Prove concurrency and observability**

Race instance starts against capacity, verify one atomic outcome, and trace every failure from request ID through operation, step, compensation, and audit evidence with secrets redacted.

**Step 7: Add commands**

Add `make capsule-qualify` for the real-host suite and a CI job that runs static/fake qualification everywhere while reserving real-KVM qualification for a labeled runner.

**Step 8: Verify and commit**

Run: `bash ./scripts/dev-doctor.sh`  
Run: `make capsule-qualify`  
Expected: all supported host gates PASS; any environmental skip is explicit and blocks release qualification.

```bash
git add backend/test/integration scripts/qualify-capsule-runtime.sh docs/runbooks examples/capsules/qualification-three-node examples/scenarios/qualification-three-node Makefile .github/workflows/ci.yml
git commit -m "test: qualify capsule runtime on kvm"
```

## Task 17: Add operational readiness without unsupported claims

**Files:**
- Create: `backend/platform/metrics.js`
- Create: `backend/routes/health.js`
- Create: `docs/runbooks/CAPSULE-INCIDENTS.md`
- Create: `docs/runbooks/BACKUP-RESTORE.md`
- Create: `docs/runbooks/UPGRADE-ROLLBACK.md`
- Create: `docs/runbooks/CAPACITY.md`
- Create: `docs/security/CAPSULE-THREAT-MODEL.md`
- Create: `backend/test/health-metrics.test.js`
- Modify: `backend/app.js`
- Modify: `docker-compose.yml`
- Modify: `README.md`

**Step 1: Write failing health and metrics tests**

Cover API liveness, DB readiness, migration compatibility, runner lease freshness, QEMU/KVM capability, storage writability/capacity, Guacamole readiness, and degraded-vs-unhealthy semantics.

**Step 2: Run focused tests**

Run: `cd backend && node --test test/health-metrics.test.js`  
Expected: FAIL.

**Step 3: Implement bounded metrics and readiness**

Expose operation latency/failures, active and reserved capacity, VMs, reconciliation drift, cleanup failures, console grants, verification outcomes, and storage usage without high-cardinality user or instance labels.

**Step 4: Write and exercise runbooks**

Cover failed provisioning, leaked-resource investigation, runner loss, DB restore, image/checkpoint storage restore, upgrade order, rollback limits, capacity exhaustion, and audit access.

**Step 5: Complete threat model**

Include untrusted images, authored documents, guest escape assumptions, console access, guest commands, plugins, external connectors, filesystem paths, networking, secrets, artifacts, and administrator boundaries.

**Step 6: Verify and commit**

Run: `cd backend && node --test test/health-metrics.test.js && cd .. && docker compose config --quiet`  
Expected: PASS.

```bash
git add backend/platform/metrics.js backend/routes/health.js backend/app.js backend/test/health-metrics.test.js docs/runbooks docs/security README.md docker-compose.yml
git commit -m "feat: add capsule operational readiness"
```

## Task 18: Hard cut over and delete all legacy paths

**Files:**
- Delete: `backend/modules/labManager.js`
- Delete: `backend/modules/nodeManager.js`
- Delete: `backend/modules/nodeManagerPostgres.js`
- Delete: `backend/modules/qemuManager.js`
- Delete: `backend/modules/qemuManager.js.backup`
- Delete: `backend/modules/capsuleRouter.js`
- Delete: `backend/modules/capsuleRepository.js`
- Delete: `backend/modules/instanceRepository.js`
- Delete: `backend/modules/operationRepository.js`
- Delete: `backend/modules/networkAllocator.js`
- Delete: `backend/modules/localRunner.js`
- Delete: `frontend/app/lab/page.tsx`
- Create: `backend/migrations/0009_drop_empty_legacy_lab_runtime.cjs`
- Create: `backend/test/legacy-cutover.test.js`
- Modify: `backend/server.js`
- Modify: `backend/app.js`
- Modify: `backend/scripts/check-schema.js`
- Modify: `backend/scripts/check-architecture.js`
- Modify: `backend/package.json`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/types.ts`
- Modify: `docs/plans/capsule-legacy-replacement-ledger.md`

**Step 1: Write the failing cutover test first**

Assert legacy routes return `404`, forbidden files/imports are absent, legacy topology keys are rejected by new APIs, old tables are not required, and the architecture checker has no allowlist.

**Step 2: Run the cutover test**

Run: `cd backend && node --test test/legacy-cutover.test.js && npm run architecture:check`  
Expected: FAIL with every remaining legacy path listed.

**Step 3: Stop registering legacy behavior**

Remove all `/api/labs` and standalone `/api/nodes` routes, manager initialization, direct host lifecycle code, old WebSocket coupling, and legacy RBAC helpers.

**Step 4: Delete legacy modules and UI**

Delete only after all new service and frontend tests pass. Remove temporary facades and adapters identified in the ledger.

**Step 5: Add an empty-table preflight migration**

Before dropping `sandlabx_labs`, `sandlabx_nodes`, `sandlabx_connections`, and `sandlabx_console_sessions`, query counts and raise an exception if any row exists. Drop related triggers, functions, indexes, and foreign keys only after the preflight passes.

**Step 6: Remove legacy frontend types and clients**

Repository-wide search must find no executable use of `topologyJson`, legacy `nodes[]/edges[]`, standalone node lifecycle endpoints, or local-storage topology authority.

**Step 7: Turn on architecture enforcement**

Add `npm run architecture:check` to `backend/package.json`'s `check` command and CI. Remove all temporary allowlists.

**Step 8: Verify debt deletion**

Run:

```bash
rg -n "LabManager|nodeManagerPostgres|/api/labs|/api/nodes|topologyJson|PC1|PC2|qemuManager\.js\.backup" backend frontend --glob '!test/fixtures/**'
```

Expected: no executable matches; documentation references only explain retirement.

**Step 9: Run full gates and commit**

Run: `cd backend && npm run check && npm run architecture:check`  
Run: `cd frontend && npm test && npm run build`  
Run: `docker compose config --quiet`  
Expected: PASS.

```bash
git add -A backend frontend docs/plans/capsule-legacy-replacement-ledger.md
git commit -m "refactor: remove legacy lab runtime"
```

## Task 19: Final documentation, release evidence, and PR gate

**Files:**
- Modify: `README.md`
- Modify: `QUICK-START.md`
- Modify: `backend/README.md`
- Modify: `frontend/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/CAPSULES.md`
- Modify: `docs/DATABASE-SCHEMA.md`
- Modify: `docs/README.md`
- Modify: `STRUCTURE.md`
- Modify: `docs/plans/2026-07-17-lab-capsules-scenario-engine.md`
- Modify: `docs/plans/capsule-legacy-replacement-ledger.md`
- Create: `docs/reports/CAPSULE-PLATFORM-QUALIFICATION.md`

**Step 1: Update current documentation**

Describe the final canonical model, draft run behavior, separate Scenarios, isolated networking, profiles, runner, reconciliation, observability, roles, quotas, checkpoints, and exact supported/unsupported configurations.

**Step 2: Archive or mark the old proposal superseded**

The 2026-07-17 plan must point to the approved architecture and this implementation plan. It must not claim prototype Phase 0-5 behavior is the completed final architecture.

**Step 3: Complete the ledger**

Every legacy item must have deletion evidence. No row may remain in `pending`, `adapter`, or `unknown` state.

**Step 4: Record qualification evidence**

Include exact commit, commands, host capabilities, test results, skipped gates, known limitations, security review status, backup/restore evidence, rollback guidance, and observed cleanup results.

**Step 5: Run the complete local gate**

Run:

```bash
cd backend && npm run check
cd ../frontend && npm test && npm run build
cd .. && docker compose config --quiet
bash ./scripts/dev-doctor.sh
make capsule-qualify
```

Expected: all software gates PASS. Real-host gates must PASS on the target KVM host before release qualification; environmental skips are documented as blockers.

**Step 6: Commit documentation**

```bash
git add README.md QUICK-START.md backend/README.md frontend/README.md docs STRUCTURE.md
git commit -m "docs: qualify capsule platform replacement"
```

**Step 7: Prepare the pull request**

The PR description must include problem, architecture, user-visible changes, schema/cutover behavior, tests, real-host evidence, security and data risks, rollback constraints, deleted legacy surfaces, observability, and intentionally deferred work.

Do not merge until required CI and real-host qualification evidence match the final commit. Do not tag a release merely because the branch merges.

## Deferred work

The following are architecture extension points, not part of this implementation:

- internet egress and host/external connectors;
- cross-instance networks;
- physical NIC passthrough;
- live NIC hot-plug outside qualified driver support;
- multi-host scheduling and live migration;
- containers or non-QEMU runtimes;
- shared real-time group instances;
- arbitrary Scenario-authored host scripts;
- user-uploaded executable verifier plugins;
- unrestricted port forwarding;
- automatic support claims for unqualified VM images.

Each deferred feature requires its own design review, threat model update, capability contract, migration plan, tests, and operational qualification.

## Parallel execution status

This is the coordinator-owned status ledger. Agent packets contain detailed evidence.

| Agent | Scope | Status | Evidence / blocker |
|---|---|---|---|
| A | Foundation, contracts, additive schema | COMPLETE | Agent commits through `1804f8b`; shared gates `5b8d706`; security review fix `6fd3c8d`; 42 tests, disposable migration/adoption, and legacy-upgrade gates pass. Live Compose DB has not yet applied `0004`/`0005`. |
| B | Control plane and API | COMPLETE | Remediation `62e1154`/`37fd315`; PostgreSQL 1/1, services 8/8, API 5/5, backend 67/67, and legacy upgrade through `0007` pass. H must compose owner-scoped events. |
| C | Images and workload profiles | COMPLETE | Agent work plus persistence remediation `05a65c4`/`20c6967`/`063e847`; focused 6/6, backend 62/62, concurrent publication, disposable migration, and legacy-upgrade gates pass. |
| D | Planning and admission | COMPLETE | Remediation `23762be`; full schema-v2 fixture comparison, PostgreSQL capacity/release/reuse coverage, backend 76/76, migration/adoption, and legacy upgrade through `0008` pass after shared ledger registration. |
| E | Runtime and runner | READY | Agent D plan/admission contract is accepted. Use temporary roots for tests and follow the shared virtualization preflight for live gates. |
| F | Scenarios and verification | COMPLETE | Commits `cfb6800`/`7805454`/`a10fcfe`/`bb2a4c0`; focused 9/9 and backend 76/76 pass. Qualified real guest transport and persistent attempt composition belong to E/H integration. |
| G | Frontend | PARTIAL / READY | Canonical and landed-v2 remediation accepted; may now integrate F result/evidence shapes. Runtime/capacity/console/destructive/checkpoint/list integrations still wait for E/H. |
| H | Integration and cutover | PARTIAL / BLOCKED | Foundation and C persistence integration are complete; mount C provisionally, but final composition/cutover waits for accepted B, D, E, F, and G handoffs. |
