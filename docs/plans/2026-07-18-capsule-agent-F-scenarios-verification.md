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
- Branch/worktree: `feat/capsule-F-scenarios-verification`.

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

