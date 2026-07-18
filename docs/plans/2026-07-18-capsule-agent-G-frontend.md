# Agent G - Capsule Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the JSON-only and legacy lab experiences with a canonical Capsule dashboard, visual editor, runtime console, Scenario, assignment, checkpoint, and destructive-action workflow.

**Architecture:** The backend draft is authoritative. React Flow is a projection of canonical Capsule data; run mode displays desired and observed state separately and consumes durable operation events.

**Tech Stack:** Next.js 15, React 19, TypeScript, React Flow, xterm, Guacamole, Vitest, React Testing Library.

---

## Source of truth

- Editor/dashboard design: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:266-273`
- Networking behavior: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:222-231`
- Authorization/state safety: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:232-265`
- Master Tasks 13-15: `docs/plans/2026-07-18-capsule-platform-replacement.md:654-787`

Sources are read-only.

## Dependencies and branch

- Blocked initially by: Agent A canonical document types.
- Use contract fixtures/mocks while Agent B APIs, Agent E runtime events, and Agent F checks are in flight.
- Final integration blocked by: Agents B, E, and F.
- Blocks: Agent H cutover and end-to-end qualification.
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[G]` on every commit subject.
- Optional worktree: `feat/capsule-G-frontend`.

## Exclusive file ownership

- `frontend/**`

Do not delete `frontend/app/lab/page.tsx` during parallel development; Agent H owns final legacy deletion. Avoid unrelated account/auth redesign.

## Execution tasks

### Task G1: Test harness, client, and dashboard

Follow master Task 13. Add frontend tests, canonical types/client, resumable events, dashboard lists, capacity, assignments, and operation failures.

Run: `cd frontend && npm test && npm run build`  
Expected: PASS.

Commit: `feat(frontend): add capsule dashboard`

### Task G2: Canonical visual editor

Follow master Task 14. Build blank-canvas node placement, profile interfaces, exact wiring, shared segments, unwired nodes, validation mapping, autosave revisions, conflicts, and backend-authoritative state. JSON remains an advanced import/export view.

Run: `cd frontend && npm test -- CapsuleEditor && npm run build`  
Expected: PASS.

Commit: `feat(frontend): build canonical capsule editor`

### Task G3: Runtime and Scenario UX

Follow master Task 15. Implement desired/observed topology, operation progress, serial/VNC launch, link simulation, checkpoint/reset/destroy impact flows, Scenario progress, and visible audited instructor access.

Run: `cd frontend && npm test && npm run build`  
Expected: PASS with mock contracts.

Commit: `feat(frontend): add capsule runtime workflows`

### Task G4: Replace mocks with landed contracts

Rebase after Agents B, E, and F land. Replace fixtures only at the typed client boundary. Do not add backend-shape workarounds inside components.

Run: `cd frontend && npm test && npm run build`  
Expected: PASS.

Commit: `fix(frontend): integrate capsule service contracts`

## Handoff requirements

Provide Agent H final SHA, test/build output, route requirements, event assumptions, deleted/replaced legacy components, accessibility gaps, and screenshots or manual verification notes. Append completion evidence here only.

## Completion evidence

- Status: REMEDIATION REQUIRED
- Branch and final HEAD: `feat/lab-capsules-scenario-engine`; evidence commit follows the implementation commit below.
- Commits: `ecb3916f754b099872e6794b048729cf2c0f8256` (`[G] feat: add capsule frontend workflows`); this evidence is committed separately.
- Owned files changed: canonical client/types/event stream, Vitest harness, dashboard, Capsules visual workspace, editor components, instance runtime components, Scenario and assignment routes, frontend documentation, and Hallmark tokens/log.
- Contracts exported: `capsuleApi`, canonical `CapsuleDocument`/draft/instance/operation types, resumable-event cursor and EventSource connector.
- Tests run and results: `cd frontend && npm test` — 4 files / 5 tests passed; `cd frontend && npm run build` — compiled all 10 routes and type-checked successfully.
- External/runtime gates: graph updated with `graphify update .`; real API/host validation not attempted because the current backend lacks capacity, assignment, console-grant, impact-preview, destruction, and durable event-stream endpoints.
- Known limitations: `capsuleApi` surfaces `CONTRACT_PENDING` for the missing planned service contracts. The current backend's prototype Capsule routes support draft, publish, instance action, operation, verification, and checkpoint flows only; final integrations must be implemented at the typed client boundary after Agents B, E, and F land.
- Requested changes for Agent H-owned files: wire the authenticated navigation to `/dashboard`, `/capsules`, `/assignments`, and instance runtime routes; remove legacy `/lab` only during final cutover.
- Downstream agents unblocked: Agent H can compose the routes and replace only the pending typed-client methods once authoritative service contracts are available.

## Coordinator review - remediation required

- Status remains `REMEDIATION REQUIRED`; the current build is green but its typed model is not yet canonical.
- Remove embedded `scenarios` from `CapsuleDocument`. Scenario remains a separate object that pins an exact immutable Capsule version.
- Align node contracts with Agent A: exact image artifact and workload-profile versions, interface objects with stable identifiers, and canonical link/interface references. Do not retain frontend-only `profileId` or string-interface substitutes.
- Move landed Agent B calls to the `/api/v2/*` route families and update fixtures to the actual request/response and resumable-SSE shapes. Keep `CONTRACT_PENDING` only for genuinely unlanded Agent E/F/H capabilities.
- Add contract tests that consume shared backend fixtures or equivalent canonical examples, including desired-versus-observed topology and event cursor resume behavior. A successful isolated frontend build is necessary but not sufficient.
- Do not claim dashboard/runtime integration complete while capacity, console grants, impact preview/destruction, and durable runtime APIs remain pending. Preserve the visual workflows behind typed boundaries.
- Re-run frontend tests/build and append remediation commits and exact pending-contract inventory here for coordinator acceptance.
