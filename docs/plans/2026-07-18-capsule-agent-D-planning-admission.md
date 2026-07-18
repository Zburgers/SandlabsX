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
