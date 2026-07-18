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
