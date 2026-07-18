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
