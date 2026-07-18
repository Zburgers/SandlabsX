# Agent A - Capsule Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish the shared architecture guardrails, database/observability foundation, canonical domain contracts, and final additive schema that every other Capsule agent consumes.

**Architecture:** This packet owns the dependency root. It publishes stable domain and persistence contracts without implementing image, planning, runtime, Scenario execution, frontend, or final integration behavior.

**Tech Stack:** Node.js 20, PostgreSQL 16, node-pg-migrate, Pino, Node test runner.

---

## Source of truth - read before editing

- Architecture design: `docs/plans/2026-07-18-capsule-platform-architecture-design.md`
  - decisions and constraints: lines 7-54
  - process and component boundaries: lines 55-110
  - canonical data model: lines 129-185
  - observability and security: lines 274-310
- Master implementation plan: `docs/plans/2026-07-18-capsule-platform-replacement.md`
  - execution rules: lines 13-24
  - Task 1: lines 26-97
  - Task 2: lines 98-159
  - Task 3: lines 160-212
  - Task 4: lines 213-259

The architecture design and master plan are authoritative and read-only. If implementation evidence requires a change, stop and send a precise proposal to Agent H; do not silently rewrite either source.

## Dependencies and branch

- Blocked by: none.
- Blocks: Agents B, C, D, E, F, and G.
- Work in a dedicated branch/worktree: `feat/capsule-A-foundation`.
- Base the branch on commit `f903fb1` or the integration branch commit containing both source-of-truth documents.

## Exclusive file ownership

- `backend/domain/**`
- `backend/platform/database.js`
- `backend/platform/observability.js`
- `backend/platform/errors.js`
- `backend/platform/auditRepository.js`
- `backend/middleware/requestContext.js`
- `backend/scripts/check-architecture.js`
- `backend/test/architecture.test.js`
- `backend/test/observability.test.js`
- `backend/test/database.test.js`
- `backend/test/capsule-domain.test.js`
- `backend/test/scenario-domain.test.js`
- `backend/test/workload-profile.test.js`
- `backend/test/migrations-capsule-platform.test.js`
- `backend/migrations/0004_capsule_platform_schema.cjs`
- `backend/migrations/0005_capsule_platform_constraints.cjs`
- `docs/plans/capsule-legacy-replacement-ledger.md`

Shared files `backend/package.json`, `backend/logger.js`, migration scripts, schema docs, and `server.js` are owned by Agent H. Provide Agent H with a small requested-change patch or commit note; do not edit those files.

## Interface contracts to publish

Export stable contracts for:

```js
normalizeCapsule(document)
validateCapsule(document, context)
hashCapsule(document)
normalizeScenario(document)
validateScenario(document, capsuleVersion)
validateWorkloadProfile(profile)
assertStateTransition(machine, from, to)
createDatabase(config)
withTransaction(pool, fn)
createObservability(config)
toPublicError(error)
```

No exported domain function may import Express, PostgreSQL, filesystem, QEMU, or concrete repositories.

## Execution tasks

### Task A1: Legacy ledger and architecture inventory

Follow master Task 1 exactly. Write the failing inventory test, implement deterministic inventory/enforcement modes, and populate every ledger row with replacement owner and deletion evidence target.

Run: `cd backend && node --test test/architecture.test.js`  
Expected: PASS in inventory mode while accurately reporting current debt.

Commit: `test: inventory capsule replacement debt`

### Task A2: Database and observability foundation

Follow master Task 2, except shared composition-file edits belong to Agent H. Implement one pool factory, transaction helper, structured correlation, central recursive redaction, stable error mapping, and durable audit repository.

Run: `cd backend && node --test test/observability.test.js test/database.test.js`  
Expected: PASS, including recursive secret redaction and transaction rollback.

Commit: `feat: add capsule platform foundations`

### Task A3: Canonical domain contracts

Follow master Task 3. Keep Scenarios outside Capsule documents, model exact image/profile versions, and make semantic hashes independent of display labels and canvas positions.

Run: `cd backend && node --test test/capsule-domain.test.js test/scenario-domain.test.js test/workload-profile.test.js`  
Expected: PASS.

Commit: `feat: define canonical capsule contracts`

### Task A4: Final additive schema

Follow master Task 4. Add final tables and constraints without dropping legacy tables. Test fresh and adopted databases. Do not modify baseline migrations.

Run: `cd backend && node --test test/migrations-capsule-platform.test.js`  
Expected: PASS against disposable PostgreSQL; skip only with an explicit prerequisite failure.

Commit: `feat(db): add capsule platform schema`

## Handoff requirements

Send all downstream agents:

- final commit SHA;
- exported domain function names and module paths;
- migration table/column contract;
- structured error and observability field contract;
- known deviations or unresolved questions;
- focused test output.

Update this packet with a final `## Completion evidence` section, but do not edit the source-of-truth documents.

