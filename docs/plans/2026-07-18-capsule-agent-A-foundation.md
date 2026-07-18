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
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[A]` on every commit subject.
- If using a dedicated worktree, use `feat/capsule-A-foundation` based on the integration branch.

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

## Coordinator review status - remediation required

Agent A is not complete as of commit `9176d21`.

Independent evidence:

- `npm test` and `npm run check` pass 28 tests.
- A healthy PostgreSQL 16 Compose service was available.
- Migrations `0001` through `0005` execute successfully on a disposable database.
- The disposable database was removed after verification.

Blocking omissions:

1. Required files are missing:
   - `backend/test/observability.test.js`
   - `backend/test/database.test.js`
   - `backend/test/migrations-capsule-platform.test.js`
2. `0004`/`0005` do not implement the final approved schema. At minimum they omit Capsule-version artifacts, Scenario drafts/compatibility, bundles, instance disks, network allocations, console endpoints, runtime observations, operation attempts, verification results, checkpoint node disks, configuration artifacts, image capture operations, assignments/members, Scenario attempts/stage/check results, and scores.
3. Migration tests do not prove fresh install, adoption, constraints, indexes, foreign keys, transactional rollback, or safe rerun behavior.
4. The architecture checker inventories only a subset of required debt. It must cover legacy route registration, topology keys, fixed TAP/MAC/node-name behavior, shell-string execution, backup files, direct host mutation, and temporary adapters.
5. The replacement ledger is only a summary. Task A1 requires exact routes, modules, tables, frontend paths, topology fields, scripts, tests, documentation references, target owner, milestone, and deletion evidence.
6. Domain tests are too shallow to establish the approved contracts. Add coverage for identifier collisions, duplicate interfaces, interface reuse, point-to-point/shared segment cardinality, exact image/profile versions, resource bounds, semantic-vs-presentation hashing, Scenario node/interface/checkpoint/artifact references, workload capability combinations, and every allowed/forbidden state transition.
7. Observability/database behavior has no dedicated tests. Prove recursive redaction, safe error mapping without internal-message leakage, correlation propagation, bounded fields, audit inserts, transaction commit/rollback/release, healthcheck, and close behavior.
8. No committed `## Completion evidence` handoff exists.

Remediation must use `[A]` commit prefixes, run the disposable PostgreSQL gate, append completion evidence, and leave the status as `REMEDIATION REQUIRED` until all items pass.

## Completion evidence

- Status: COMPLETE - accepted by coordinator after shared-gate integration
- Branch and final HEAD: `feat/lab-capsules-scenario-engine` at `68e5b49` before this evidence commit.
- Commits:
  - `8f4f179 [A] test: expand capsule foundation gates`
  - `f83ba4f [A] feat: harden capsule domain contracts`
  - `68e5b49 [A] feat(db): complete capsule platform schema`
- Owned files changed: `backend/domain/**`, `backend/platform/{database,observability,errors,auditRepository}.js`, `backend/middleware/requestContext.js`, `backend/scripts/check-architecture.js`, Agent A focused tests, migrations `0004`/`0005`, the replacement ledger, and the OSPF Capsule/Scenario fixtures.
- Contracts exported: `normalizeCapsule`, `validateCapsule`, `hashCapsule`, `normalizeScenario`, `validateScenario`, `validateWorkloadProfile`, `assertStateTransition`, `createDatabase`, `withTransaction`, `createObservability`, and `toPublicError` from the paths named in this packet.
- Tests run and results:
  - `node --test test/architecture.test.js test/observability.test.js test/database.test.js test/capsule-domain.test.js test/scenario-domain.test.js test/workload-profile.test.js test/migrations-capsule-platform.test.js`: 19 passed.
  - `npm test`: 42 passed.
  - `npm run check`: passed.
  - `node scripts/check-architecture.js inventory`, syntax checks for `0004`/`0005`, and `git diff --check`: passed.
- External/runtime gates:
  - Healthy Compose PostgreSQL 16 at `127.0.0.1:5432` was used.
  - `test/migrations-capsule-platform.test.js` created and removed a disposable database, migrated `0001`–`0005`, asserted 38 final tables plus constraints/indexes/foreign keys, reran migrations safely, and preserved an adopted row.
  - `DATABASE_URL=postgresql://guacamole_user:guacamole_pass@127.0.0.1:5432/guacamole_db npm run db:test-legacy-upgrade` migrated and passed `db:check`, but failed its stale `Expected 3 migrations, found 5` assertion.
- Known limitations: No real-KVM, runner, recovery, security, backup, or final cutover qualification is claimed; those are outside Agent A.
- Requested changes for Agent H-owned files:
  - In `backend/scripts/test-legacy-upgrade.js`, replace the hard-coded `migrations.rowCount !== 3` assertion with an assertion for the exact applied names `0001_core_schema` through `0005_capsule_platform_constraints` (or update the count to 5). Then rerun the command above.
  - In `backend/package.json`, add `architecture:inventory` and `architecture:check` scripts and add syntax checks for migrations `0004`/`0005`; do not add enforce mode to the global gate until Task 18.
  - In `backend/scripts/check-schema.js`, add the final Capsule tables/constraints to the schema verification contract and label legacy tables pending deletion.
- Downstream agents unblocked: Agents B, C, and G. Agent D waits for Agent C's profile-contract checkpoint; Agent F waits for Agent B's service contracts; Agent E waits for Agent D's plan contract.

### Coordinator acceptance

- Shared Agent H requests applied in `5b8d706 [H] test: integrate capsule schema gates`.
- Security review fixes applied in `6fd3c8d [coord] fix: redact audit and internal errors`.
- Independent `npm run check`: PASS, 42 tests.
- Independent disposable PostgreSQL migration/adoption test: PASS, 38 final Capsule tables asserted and disposable database removed.
- Independent legacy-upgrade test: PASS, migrations `0001` through `0005`, 46 total required tables, four Capsule constraints, preserved legacy user data, and pending legacy-table deletion reported.
- Architecture inventory: PASS in inventory mode; enforcement intentionally remains deferred until Task 18 removes inventoried debt.
- Live Compose database note: its standalone `db:check` remains pending until the running stack deliberately applies migrations `0004` and `0005`; no live database mutation was performed during review.
