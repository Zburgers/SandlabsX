# Agent F - Scenarios and Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement independently versioned educational Scenarios with typed checks, bounded in-guest commands, evidence, scoring, and assignment-run integration.

**Architecture:** Scenario documents never execute host code. Built-in checks and administrator-installed verifier code run through explicit registries; custom instructor commands run only inside a designated owned VM through a qualified transport.

**Tech Stack:** Node.js 20, PostgreSQL, serial/guest command transports, Node test runner.

---

## Source of truth

- Scenario design: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:245-256`
- Authorization: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:257-265`
- Master Task 11: `docs/plans/2026-07-18-capsule-platform-replacement.md:555-600`

Sources are read-only.

## Dependencies and branch

- Blocked by: Agent A domain contract and Agent B Scenario/assignment service interfaces.
- May mock runtime transports until Agent E publishes them.
- Blocks: Agent G final Scenario UX integration and Agent H qualification.
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[F]` on every commit subject.
- Optional worktree: `feat/capsule-F-scenarios-verification`.

## Exclusive file ownership

- `backend/verification/**`
- `backend/services/verificationService.js`
- `backend/test/typed-checks.test.js`
- `backend/test/guest-command-check.test.js`
- `backend/test/scenario-run.test.js`
- `backend/modules/verificationRunner.js`
- `examples/scenarios/**`

Agent H owns final docs and deletes the temporary verification facade.

## Execution tasks

### Task F1: Typed check registry

Write failing tests and implement readiness, topology, interface/link, ping, service, serial output, artifact, retry, timeout, score, hint, and bounded redacted evidence checks.

Run: `cd backend && node --test test/typed-checks.test.js`  
Expected: PASS after implementation.

Commit: `feat: add typed scenario checks`

### Task F2: Bounded guest commands

Require instructor author, explicit target VM, qualified transport, argument array, limits, instance ownership, redaction, and audit. Reject shell strings, host targets, module paths, and uninstalled plugins.

Run: `cd backend && node --test test/guest-command-check.test.js`  
Expected: PASS.

Commit: `feat: add bounded guest verification`

### Task F3: Scenario runs and OSPF fixture

Implement ordered stages, exact version pinning, attempts, results, scoring, and evidence. Move OSPF learning content into `examples/scenarios/ospf-failure-recovery/`.

Run: `cd backend && node --test test/scenario-run.test.js test/typed-checks.test.js test/guest-command-check.test.js`  
Expected: PASS.

Commit: `feat: run versioned learning scenarios`

## Handoff requirements

Provide Agents G and H final SHA, check schemas, event/evidence shapes, transport interface, security limits, example Scenario, and test output. Append completion evidence here only.

## Completion evidence

- Status: BLOCKED
- Branch and final HEAD: `feat/lab-capsules-scenario-engine` at `a10fcfe4cb55cb9bcbe39ada38b11b5e02cb4e70` (implementation head before this evidence commit)
- Commits: `cfb68009c1fa86b4bebb79edd851676ce7d5966c` (`[F] feat: add typed scenario checks`); `7805454b42e168810bf33673ac915feee85e6129` (`[F] feat: add bounded guest verification`); `a10fcfe4cb55cb9bcbe39ada38b11b5e02cb4e70` (`[F] feat: run versioned learning scenarios`)
- Owned files changed: `backend/verification/checkRegistry.js`; `backend/verification/typedChecks.js`; `backend/verification/guestCommandCheck.js`; `backend/verification/evidenceService.js`; `backend/services/verificationService.js`; `backend/modules/verificationRunner.js`; `backend/test/typed-checks.test.js`; `backend/test/guest-command-check.test.js`; `backend/test/scenario-run.test.js`; `examples/scenarios/ospf-failure-recovery/scenario.json`; `examples/scenarios/ospf-failure-recovery/README.md`
- Contracts exported: `TypedCheckRunner.runStage(stage, context)` supports `nodeReadiness`, `topology`, `interfaceLink`, `ping`, `servicePort`, `serialOutput`, and `artifactContent` with `{ status, score, maximumScore, results }`; each result has `{ id, type, status, attempts, expected, observed, evidence, hint? }`. `GuestCommandCheck.run(check, { actor, instance })` requires an administrator/instructor, an instance-owned VM node, `transport.qualified === true`, and `transport.execute({ instanceId, targetVm, argv, limits })`; it returns `{ observed, evidence: { output, exitCode }, passed }`. `ScenarioRunService.run({ actor, assignment, instance, scenarioVersion }, context)` returns exact-version pinned `{ id, status, score, maximumScore, stages, evidence }` and records in-memory attempts pending persistence integration.
- Tests run and results: initial failing tests observed for each new suite because their implementation modules did not exist; `cd backend && node --test test/scenario-run.test.js test/typed-checks.test.js test/guest-command-check.test.js` passed 9/9; `cd backend && npm run check` passed 76/76; `docker compose config --quiet` passed; `git diff --check` passed.
- External/runtime gates: `make prepare` was attempted from the repository root and blocked with `ERROR: vms is not writable by uid 1000. Stop the stack, then repair only the bind-mount root with: sudo chown 1000:1000 vms`; consequently `make doctor` and real guest-transport/KVM qualification were not run. Graph updated with `graphify update .`.
- Known limitations: guest transports remain dependency-injected and mocked in tests; scenario documents do not execute host code; real transport qualification awaits repaired `vms/` ownership and Agent E's published transport.
- Requested changes for Agent H-owned files: delete the compatibility `VerificationRunner` facade only after all legacy callers use `ScenarioRunService`/`TypedCheckRunner`; compose `createScenarioRunService` with Agent E's qualified transport and a persistent attempt repository.
- Downstream agents unblocked: Agent G can consume the result/evidence/stage shapes and the OSPF example; Agent H can qualify the injected transport after host preflight is repaired.

## Coordinator acceptance

- Status override: `COMPLETE` for Agent F's owned typed-check, bounded guest-command, Scenario-run, evidence, scoring, and example contracts.
- Acceptance evidence: focused F suite passes 9/9; full backend passes 76/76; Compose configuration and diff checks pass. The implementation correctly refuses an unqualified transport, so unavailable host bind roots do not invalidate this dependency-injected slice.
- Deferred integration: Agent E supplies and qualifies the real guest transport; Agent H composes persistent attempt/result repositories, mounts the API, and performs real-KVM Scenario qualification after the shared host preflight passes.
- Agent G may consume the accepted result, stage, score, and evidence shapes now.

## 2026-07-19 integration update

- Status: REMEDIATION REQUIRED.
- Typed checks, bounded evidence, scoring, and the canonical `ScenarioAttempt` shape remain green in unit tests.
- The authenticated production Scenario-run route is not mounted because the current `ScenarioRunService` attempt-limit state remains in memory and no qualified production guest transport is composed. The frontend call therefore correctly remains `CONTRACT_PENDING`.
- Required follow-up: persist attempt/stage/check/score rows transactionally, compose the owned guest transport, mount the exact-version assignment route, and qualify it without claiming real KVM in this slice.
