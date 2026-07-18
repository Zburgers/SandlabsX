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
- `backend/migrations/0006_drop_empty_legacy_lab_runtime.cjs`
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
