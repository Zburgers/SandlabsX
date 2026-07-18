# Agent B - Capsule Control Plane and API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement transactional Capsule, Scenario, assignment, instance, operation, and allocation repositories/services plus thin versioned HTTP routers.

**Architecture:** Application services own policy and transactions; repositories own persistence mechanics; routers map transport only. Host mutation remains outside this packet.

**Tech Stack:** Node.js 20, Express, PostgreSQL, Node test runner, SSE.

---

## Source of truth

- Design: `docs/plans/2026-07-18-capsule-platform-architecture-design.md`
  - process/components: lines 55-110
  - data/lifecycle: lines 129-202
  - authorization/editor contract: lines 257-273
- Master plan: `docs/plans/2026-07-18-capsule-platform-replacement.md`
  - Task 5: lines 260-310
  - Task 12: lines 601-653

Both documents are read-only. Report proposed changes to Agent H.

## Dependencies and branch

- Blocked by: Agent A final foundation commit.
- Blocks: Agent F Scenario integration, Agent G live API integration, Agent H composition/cutover.
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[B]` on every commit subject.
- Optional worktree: `feat/capsule-B-control-plane-api`.

## Exclusive file ownership

- `backend/repositories/capsuleRepository.js`
- `backend/repositories/scenarioRepository.js`
- `backend/repositories/instanceRepository.js`
- `backend/repositories/operationRepository.js`
- `backend/repositories/allocationRepository.js`
- `backend/repositories/assignmentRepository.js`
- `backend/services/capsuleService.js`
- `backend/services/scenarioService.js`
- `backend/services/assignmentService.js`
- `backend/routes/capsules.js`
- `backend/routes/scenarios.js`
- `backend/routes/instances.js`
- `backend/routes/operations.js`
- `backend/routes/assignments.js`
- `backend/routes/events.js`
- `backend/test/capsule-service.test.js`
- `backend/test/scenario-service.test.js`
- `backend/test/assignment-service.test.js`
- `backend/test/capsule-api-v2.test.js`
- `backend/test/instance-api.test.js`
- `backend/test/authorization-api.test.js`

Agent H owns `backend/app.js`, `backend/server.js`, `backend/swagger.js`, and package scripts. Export routers through clear factories; do not modify composition files.

## Required contracts

- Import canonical domain and error contracts from Agent A without copying them.
- Expose router factories accepting service dependencies.
- Expose service methods for draft CRUD, private revision/run, publication, plan preview request, instance creation, lifecycle operation submission, Scenario publication, assignment, event query/stream, and authorization.
- Host operations are represented only as durable operation intents.

## Execution tasks

### Task B1: Repositories and service TDD

Implement master Task 5. Test optimistic concurrency, immutable publication, exact version references, rollback, idempotency, and service-layer authorization.

Run: `cd backend && node --test test/capsule-service.test.js test/scenario-service.test.js test/assignment-service.test.js`  
Expected: PASS.

Commit: `feat: add capsule control plane services`

### Task B2: Thin HTTP API

Implement master Task 12 router files. Return `202` for mutations, require idempotency keys where specified, map stable safe errors, and implement ordered resumable SSE. Do not use SQL or host services from routers.

Run: `cd backend && node --test test/capsule-api-v2.test.js test/instance-api.test.js test/authorization-api.test.js`  
Expected: PASS using a test-only Express app assembled inside tests.

Commit: `feat(api): expose capsule control plane`

## Handoff requirements

Provide Agent H and Agent G:

- route factory exports and mount paths;
- request/response examples or generated contract fixtures;
- SSE event shape and cursor rules;
- service method signatures;
- final commit SHA and tests.

Append `## Completion evidence` here only.

## Completion evidence

- Status: COMPLETE
- Branch and final HEAD: `feat/lab-capsules-scenario-engine` at completion-evidence commit (service/API commits: `f9783f874887e3a10126f467c0de7224f1227c44`, `75803102e45d7e80edfb71abf7fa6316cf1b6ee6`)
- Commits: `[B] feat: add capsule control plane services` (`f9783f8`); `[B] feat(api): expose capsule control plane` (`7580310`)
- Owned files changed: all six repositories; `capsuleService`, `scenarioService`, `assignmentService`; route factories for Capsules, Scenarios, assignments, instances, operations, and events; focused service/API tests.
- Contracts exported: `createCapsuleRouter({ capsuleService })` at `/api/v2/capsules`; `createScenarioRouter({ scenarioService })` at `/api/v2/scenarios`; `createAssignmentRouter({ assignmentService })` at `/api/v2/assignments`; `createInstanceRouter({ instanceService, operationService })` at `/api/v2/instances`; `createOperationRouter({ operationService })` at `/api/v2/operations`; `createEventRouter({ eventService })` at `/api/v2/events`. Routers accept authenticated principal data from `req.user` or `req.auth` and do not access repositories or host services.
- Tests run and results: RED gates first observed failing due to missing service/repository modules and missing routers. `node --test test/capsule-service.test.js test/scenario-service.test.js test/assignment-service.test.js` passed 8/8. `node --test test/capsule-api-v2.test.js test/instance-api.test.js test/authorization-api.test.js` passed 5/5. Full `npm test` passed 62/62. New source files passed `node -c`; `git diff --check` passed.
- External/runtime gates: no host mutation is in this packet; `make doctor` is not applicable. `graphify update .` completed successfully and refreshed the code graph.
- SSE event shape and cursor rules: `GET /api/v2/events?after=<non-negative integer>` accepts `Last-Event-ID` as the preferred resume cursor and emits ordered `id: <cursor>`, `event: <type>`, `data: <payload>` records for events strictly after that cursor. Event cursors are monotonically increasing.
- Known limitations: Agent H must assemble production services/repositories and mount these routers in `backend/app.js`/`backend/server.js`; those shared composition files were intentionally not modified. Host execution remains represented only by operation intents.
- Requested changes for Agent H-owned files: register the stated `/api/v2/*` mounts, remove prototype Capsule-router registration once the cutover is qualified, and publish corresponding Swagger/OpenAPI paths.
- Downstream agents unblocked: Agent F (Scenario integration), Agent G (live API integration), and Agent H (composition/cutover).

## Coordinator review - remediation required

- Status override: `REMEDIATION REQUIRED`. The agent evidence is preserved above, but coordinator acceptance has not been granted.
- Persist Capsule drafts in the final `sandlabx_capsule_drafts` model. Do not use the prototype `sandlabx_capsules.draft_document` column as the authoritative draft store.
- Persist and query private-run revisions separately from published versions so visibility and mutability are durable, not inferred only by service behavior.
- Replace `MAX(sequence) + 1` event allocation and equivalent version allocation with concurrency-safe database behavior. Prove ordered, unique cursors under concurrent writers.
- Add disposable-PostgreSQL integration tests for draft optimistic concurrency, immutable private/published versions, operation idempotency, event ordering/resume, rollback, and owner-scoped event access. Memory repositories alone are not acceptance evidence.
- Re-run the focused API/service tests, full `npm run check`, and legacy-upgrade gate. Append the remediation commit SHAs and exact results here; do not mark this packet complete until coordinator review accepts those gates.
- Dependency effect: Agent F remains blocked. Agent G may use the published route shapes as provisional fixtures, but must not treat persistence or event behavior as accepted.

## Remediation evidence

- Status: READY FOR COORDINATOR REVIEW (the coordinator remains the acceptance authority).
- Remediation commit: `[B] fix: persist capsule control plane transactions` (`62e115462b4e3187db9ccdbeddae608e40172b52`).
- PostgreSQL persistence: new migration `0007_capsule_control_plane_persistence` makes `sandlabx_capsule_drafts` authoritative, migrates legacy draft content once, clears the prototype `sandlabx_capsules.draft_document` column, and adds separately persisted immutable `sandlabx_capsule_private_revisions`.
- Concurrency: Capsule parents maintain row-locked published/private counters and operations maintain an atomically incremented event counter; no Capsule revision or event sequence allocation uses `MAX(...) + 1`. Operation creation uses a single `ON CONFLICT` idempotency upsert.
- Disposable PostgreSQL integration: `test/capsule-control-plane-postgres.test.js` creates and drops its own database and proves draft optimistic concurrency, private/public immutability, concurrent private revision numbering, idempotency, concurrent event sequencing, ordered cursor resume, transaction rollback, and owner-scoped event reads.
- Focused results: `node --test test/capsule-control-plane-postgres.test.js` passed 1/1; Capsule/Scenario/assignment services passed 8/8; Capsule/instance/authorization API tests passed 5/5.
- Legacy gate: `DATABASE_URL=postgresql://guacamole_user:guacamole_pass@127.0.0.1:5432/guacamole_db node scripts/test-legacy-upgrade.js` passed and recorded all seven migrations, including `0007`.
- Full gate: final `npm run check` passed 67/67. A preceding full run had one `DUPLICATE_DIGEST` failure in the separately owned image-artifact concurrent test; five isolated reruns of that suite and the final full run passed, with no Agent B changes to that ownership area.
- Source checks: `node -c` passed for the new migration and changed repositories; `git diff --check` passed. `graphify update .` completed; generated graph artifacts remain untracked.
- Requested review: accept or reject this evidence before unblocking Agent F.
