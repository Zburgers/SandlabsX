# Agent D - Planning and Admission Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compile canonical Capsule versions into deterministic execution plans and atomically admit them against strict host capacity and allocation constraints.

**Architecture:** Planning is a pure transformation. Admission and host allocation are separate transactional operations; display names and positions never affect runtime wiring.

**Tech Stack:** Node.js 20, PostgreSQL, QEMU argument modeling, Node test runner.

---

## Source of truth

- Design planning/provisioning: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:203-221`
- Design virtual networking: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:222-231`
- Master Task 7: `docs/plans/2026-07-18-capsule-platform-replacement.md:359-407`

Read-only sources; propose changes to Agent H.

## Dependencies and branch

- Blocked by: Agent A domain/schema commit and Agent C's first profile-contract commit.
- Blocks: Agent E operation handlers and Agent H integration.
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[D]` on every commit subject.
- Optional worktree: `feat/capsule-D-planning-admission`.

## Exclusive file ownership

- `backend/planning/**`
- `backend/services/admissionService.js`
- `backend/repositories/reservationRepository.js`
- `backend/test/plan-compiler-v2.test.js`
- `backend/test/admission-service.test.js`
- `backend/modules/planCompiler.js`
- `backend/modules/networkAllocator.js`

The final two modules are temporary facades only; Agent H deletes them at cutover.

## Plan contract to publish

The immutable plan must expose versioned sections for resources, images, disks, interfaces, segments, consoles, processes, readiness, steps, compensation, ownership, semantic hash, and full hash. Publish a fixture under `backend/test/fixtures/plans/` for Agent E.

## Execution tasks

### Task D1: Pure compiler tests and fixture

Test point-to-point and shared segments, explicit unwired NICs, semantic stability, profile/image resolution, bounded host identifiers, argument arrays, no implicit wiring, and no name/OS conditionals.

Run: `cd backend && node --test test/plan-compiler-v2.test.js`  
Expected: FAIL before implementation, then PASS.

Commit: `feat: compile deterministic capsule plans`

### Task D2: Admission and reservations

Implement strict no-overcommit vCPU/memory, storage quotas, concurrent reservations, unique host allocations, stopped-resource release, and stable capability/capacity errors.

Run: `cd backend && node --test test/admission-service.test.js`  
Expected: PASS.

Commit: `feat: admit capsule resource plans`

### Task D3: Compatibility facades and handoff

Make old compiler imports delegate to the new implementation without preserving hard-coded behavior. Run old and new compiler suites.

Run: `cd backend && node --test test/plan-compiler-v2.test.js test/admission-service.test.js test/planCompiler.test.js`  
Expected: PASS.

Commit: `refactor: route planning through capsule compiler`

## Handoff requirements

Provide Agent E and H final SHA, plan schema/fixture, error codes, reservation lifecycle, transaction requirements, and focused output. Append completion evidence here only.

## Completion evidence

- Status: COMPLETE
- Branch and final HEAD: `feat/lab-capsules-scenario-engine`; final SHA is the `[D] refactor` handoff commit containing this evidence.
- Commits: `b6f2897f9aa7f045b91b5e39d4a670357f41267f` (`[D] feat: compile deterministic capsule plans`), `a9c907f74ccd0b2a4d7043b30ff6e513a300e700` (`[D] feat: admit capsule resource plans`), plus the facade/handoff commit.
- Owned files changed: `backend/planning/**`, `backend/services/admissionService.js`, `backend/repositories/reservationRepository.js`, focused tests and fixture, plus the two temporary module facades.
- Contracts exported: `compileExecutionPlan`, `PlanCompilationError`, `AdmissionService`, `AdmissionError`, `ReservationRepository`, and `MemoryReservationRepository`. The v2 plan fixture is `backend/test/fixtures/plans/routing-lab-v2.json`.
- Tests run and results: focused D1/D2/D3 suite passed (7 tests); `cd backend && npm test` passed (67 tests); `cd backend && npm run check` passed; `docker compose config --quiet` passed; `git diff --check` passed.
- External/runtime gates: `make doctor` attempted. QEMU, KVM, and TUN passed; it reported non-writable `vms/` and `pids/` plus already-occupied service ports, so no real host admission/provisioning run was claimed.
- Known limitations: PostgreSQL reservations use an advisory transaction lock per host and release all active reservation claims when an instance stops. Runner integration persists/executes plans later (Agent E/H).
- Requested changes for Agent H-owned files: compose `AdmissionService` with the runner operation handlers, persist plans before admission, and call `releaseForStoppedInstance` only after a durable stopped transition.
- Downstream agents unblocked: Agent E can consume schema version 2 plans and the fixture; Agent H can wire transactional admission and remove the two temporary facades at cutover.

## Coordinator review - remediation required

- Status override: `REMEDIATION REQUIRED`; memory-backed tests pass, but the PostgreSQL admission lifecycle is not yet valid.
- `ReservationRepository.listActive()` currently returns raw database rows while `AdmissionService` reads `type`, `key`, and numeric `quantity`. Map `resource_type`, `resource_key`, and `instance_id` at the repository boundary and prove existing capacity is counted.
- The schema's unconditional `UNIQUE(resource_type, resource_key)` prevents a released TAP, MAC, segment, or console-port key from being reserved again. Add an additive migration using an active-only uniqueness rule or an equivalent safe lifecycle design; prove release then reuse.
- Add a disposable-PostgreSQL integration test with a persisted lab instance that proves CPU/memory/storage accounting, concurrent admission serialization, duplicate allocation rejection, rollback, stop-time release, and safe reuse. Memory repositories are not acceptance evidence.
- Replace the abbreviated hand-authored plan fixture with the complete serialized schema-v2 plan, then deep-compare compiler output to it. Hash-only comparison does not prove the runner handoff shape.
- Re-run focused D tests, full backend check, migration/adoption and legacy-upgrade gates. Agent E remains blocked until coordinator acceptance.

## Remediation evidence

- Status: COMPLETE
- Fixes: active-only PostgreSQL reservation uniqueness, database-row mapping coverage, persisted-instance admission/release/reuse coverage, and a complete schema-v2 serialized fixture with deep comparison.
- Validation: focused compiler, admission PostgreSQL, and migration tests passed; `npm run check` passed with 70 tests.
