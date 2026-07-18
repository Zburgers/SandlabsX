# Agent H - Capsule Integration, Qualification, and Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate all Capsule workstreams, own shared composition files, qualify the complete platform, delete every legacy path, and publish evidence-backed documentation.

**Architecture:** This is the sole integration packet. It does not redesign agent-owned modules; it composes their published contracts, resolves cross-stream defects with the owning agent, and enforces the hard cutover gates.

**Tech Stack:** Full SandLabX stack: Node.js, Express, PostgreSQL, QEMU/KVM, Linux networking, Guacamole, Next.js, Docker Compose, CI.

---

## Source of truth

- Entire approved design: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:7-319`
- Master execution rules: `docs/plans/2026-07-18-capsule-platform-replacement.md:13-24`
- Master Task 16: lines 788-837
- Master Task 17: lines 838-883
- Master Task 18: lines 884-960
- Master Task 19: lines 961-1019
- Deferred scope: lines 1020-1036

Source-of-truth documents remain authoritative. If evidence requires a correction, update them in a dedicated docs commit that names the reason; never silently weaken an acceptance gate.

## Dependencies and branch

- Blocked by final handoffs from Agents A-G.
- May begin early with composition scaffolding after Agent A, but cannot cut over until all streams pass.
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[H]` on every commit subject.
- Optional worktree: `feat/capsule-H-integration-cutover` based on the integration branch.
- Merge/cherry-pick order: A, B, C, D, E, F, G, then H integration commits. Resolve module defects in owner branches where practical.

## Exclusive file ownership

- `backend/app.js`
- `backend/server.js`
- `backend/swagger.js`
- `backend/package.json`
- `backend/logger.js`
- `backend/Dockerfile`
- `backend/scripts/check-schema.js`
- `backend/scripts/test-legacy-upgrade.js`
- `backend/migrations/0006_image_profile_versions.cjs`
- `backend/migrations/0009_drop_empty_legacy_lab_runtime.cjs`
- `backend/test/legacy-cutover.test.js`
- `backend/test/integration/**`
- `frontend/app/lab/page.tsx` deletion
- `docker-compose.yml`
- `Makefile`
- `.github/workflows/ci.yml`
- `scripts/qualify-capsule-runtime.sh`
- `docs/**` except other agents' packet completion-evidence sections
- final deletion of all temporary facades and legacy modules listed in master Task 18

## Execution tasks

### Task H1: Integrate shared composition

Apply Agent A requests for database, observability, package scripts, migration checks, logger, and schema docs. Mount Agent B/C routers and services in `app.js`; compose production dependencies and shutdown in `server.js`; add Agent E's runner command and Compose service.

Run: `cd backend && npm test && node -c app.js && node -c server.js && cd .. && docker compose config --quiet`  
Expected: PASS before legacy routes are removed.

Commit: `feat: integrate capsule platform services`

### Task H2: Operational readiness

Execute master Task 17. Add health/readiness, bounded metrics, threat model, backup/restore, upgrade/rollback, capacity, and incident runbooks. Do not claim production readiness.

Run: `cd backend && node --test test/health-metrics.test.js && cd .. && docker compose config --quiet`  
Expected: PASS.

Commit: `feat: add capsule operational readiness`

### Task H3: Real-KVM qualification

Execute master Task 16. Add guarded integration fixtures and prove authored networking, internal traffic, isolation, consoles, persistence, checkpoint/reset, restart adoption, failure compensation, concurrency, and correlated redacted evidence.

Run: `bash ./scripts/dev-doctor.sh && make capsule-qualify`  
Expected: real-host PASS. Missing KVM/TUN/images is an explicit release blocker, not a silent success.

Before qualification, follow the shared virtualization preflight. Do not run the live gate against root-owned bind roots or unidentified occupied ports. Unit/integration harnesses use temporary roots; the real gate must use writable persistent roots, identify the intended Compose listeners, capture pre/post network audits, and prove cleanup of PIDs, TAPs, bridges, overlays, and console grants.

No managed QCOW2 qualification image exists at handoff. Provision one through `ImagePipeline` with a pinned checksum and recorded provenance, validate that it has no external backing dependency, and keep the binary out of Git. Do not download an unpinned image or claim support for an unqualified appliance. Record the exact artifact digest and cleanup policy in qualification evidence.

Commit: `test: qualify capsule runtime on kvm`

### Task H4: Hard legacy cutover

Execute master Task 18 exactly. Write the failing cutover test, stop legacy route registration, delete managers/facades/old UI, add empty-table preflight migration, remove legacy types, eliminate all architecture allowlists, and enforce the checker in CI.

Run:

```bash
cd backend && npm run check && npm run architecture:check
cd ../frontend && npm test && npm run build
cd .. && docker compose config --quiet
```

Expected: PASS and no executable legacy matches.

Commit: `refactor: remove legacy lab runtime`

### Task H5: Documentation and release evidence

Execute master Task 19. Complete the ledger, supersede stale proposal claims, document exact support boundaries, and record commit-specific qualification evidence, skips, risks, rollback constraints, and follow-ups.

Run the complete gate in master Task 19 lines 994-1005.  
Expected: all software checks pass and real-host release gates have evidence.

Commit: `docs: qualify capsule platform replacement`

## Final acceptance

- Every A-G completion-evidence section is present and references a merged commit.
- No file has unresolved multi-agent ownership.
- Every legacy ledger row is `deleted` or an explicitly approved retained platform primitive.
- No temporary adapter, route, table, UI, topology shape, hard-coded network rule, or direct host mutation survives.
- The final PR includes exact CI and KVM evidence and is not merged or released on unsupported claims.

## Completion evidence

- Status: REMEDIATION REQUIRED
- Branch and final HEAD: `feat/lab-capsules-scenario-engine`; final SHA recorded after the Agent H cutover commit.
- Commits: pending commit for app composition, guarded legacy-table removal, health/readiness, and evidence documentation.
- Owned files changed: `backend/app.js`, `backend/server.js`, Swagger, schema/architecture/upgrade checks, migration `0009`, legacy-cutover and health/integration tests, deleted legacy modules/UI, and operational documentation.
- Contracts exported: canonical `/api/v2` composition, `/api/health` and `/api/health/ready`, scoped owner event reads, and guarded irreversible legacy-table migration.
- Tests run and results: `DATABASE_URL=postgresql://guacamole_user:guacamole_pass@127.0.0.1:5432/guacamole_db npm run db:test-legacy-upgrade` passed; `npm run check` passed 86 tests; `make prepare`, `make doctor`, and `docker compose config --quiet` passed.
- External/runtime gates: host preflight passed (Docker, QEMU, KVM, TUN, writable runtime roots, and ports). Real KVM qualification was not run.
- Known limitations: `OperationRepository` lacks `leaseNext`, step persistence, and operation execution methods required by `Runner`; frontend pending runtime calls lack safe mounted service contracts; no pinned managed qualification QCOW2 was supplied. These block runner Compose deployment and `make capsule-qualify`.
- Requested changes for Agent H-owned files: add and test the durable production runner persistence/lease contract and complete the pending runtime/Scenario/capacity/console routes before release qualification.
- Downstream agents unblocked: none; remediation is required before release/cutover acceptance.

## 2026-07-19 remediation evidence

- Status: REMEDIATION REQUIRED; software integration advanced, but the mounted Scenario attempt and confirmed destructive-action contracts remain pending and real-KVM qualification was not run.
- Commits: `b52ba8d`, `3989141`, `7495364`, `2387ed9`, `7acd8d1`, `a4dedfe`.
- Completed integration: PostgreSQL `SKIP LOCKED` runner leases, durable operation/step attempts and compensation state, expired-lease recovery, separate least-privilege Compose runner, persisted execution plans before admission, authenticated Capsule/assignment/capacity/topology/checkpoint/console/link-state/impact routes, and matching landed frontend calls.
- Validation: `make prepare` passed; `make doctor` passed 18 checks with four occupied-port warnings; backend `npm run check` passed 92/92 on the final rerun with architecture enforcement clean; frontend passed 12/12 and built; Compose config, diff check, and network audit passed. An earlier backend run transiently hit the concurrent immutable-image `DUPLICATE_DIGEST` assertion; both its focused rerun and the final full rerun passed.
- Remaining blockers: `capsuleApi.runVerification` and `confirmImpact` remain `CONTRACT_PENDING`; Scenario attempts still use an in-memory store; destructive cleanup lacks persisted process/resource identities sufficient to prove safe restart recovery; no pinned managed qualification image was provided and no real QEMU lifecycle was run.

## 2026-07-19 final qualification evidence

- Status: REMEDIATION REQUIRED; the platform is not release-qualified.
- Qualification fixes: `a9f304e` preserves managed-image provenance/license metadata; `03b1d1e` fixes runner health composition, the canonical NIC model, console-grant ordering, and terminal handling of pre-execution runner failures.
- Real-host evidence: pinned CirrOS `0.6.3` was imported through `ImagePipeline` as a standalone ignored QCOW2 with final SHA-256 `38c231fab65191449754070c8f06a42bd7831382fc0d7ebb1b96375ac2c50488`. A two-node plan was persisted, admitted, provisioned, and started under KVM with an instance-owned bridge, two TAPs, overlays, and console listeners. Stopped checkpoint create/restore succeeded.
- Cleanup evidence: runner restart removed QEMU PIDs and runner-network devices; exact test allocations were released manually and disk/checkpoint artifacts moved to ignored recoverable quarantine. Network audits before and after found no fixed legacy bridge or subnet.
- Release blockers: observed/runtime-owned state and events are not persisted; restart does not adopt VMs; reset/destroy lack reconstructable inputs; console transport and durable Scenario execution are absent; two frontend contracts remain pending; cross-layer correlation is incomplete; and `make capsule-qualify` exits 2 because its real-host fixture is not implemented.
- Full identifiers, commands, results, and cleanup boundaries are in `docs/reports/CAPSULE-PLATFORM-QUALIFICATION.md`.
