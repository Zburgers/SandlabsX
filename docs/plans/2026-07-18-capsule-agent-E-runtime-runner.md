# Agent E - Runtime, Runner, and State Safety Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement ownership-safe disk, network, QEMU, console, operation, reconciliation, checkpoint, reset, capture, and destruction behavior behind the approved runtime ports.

**Architecture:** Only the runner mutates host resources. Every operation step is persisted, idempotent, observable, compensatable, and reconcilable after restart.

**Tech Stack:** Node.js 20, QEMU/KVM, QCOW2, Linux TAP/bridge tools, Guacamole, PostgreSQL, Docker Compose, Node test runner.

---

## Source of truth

- Process/components: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:55-110`
- Lifecycle: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:186-202`
- Networking and state: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:222-244`
- Failure/security: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:292-310`
- Master Tasks 8-10: `docs/plans/2026-07-18-capsule-platform-replacement.md:408-554`

Sources are read-only.

## Dependencies and branch

- Blocked by: Agent A foundation and Agent D execution-plan fixture/contract.
- Uses Agent C image capture contract; mock it until Agent C lands.
- Blocks: Agent H runtime composition and qualification.
- Branch/worktree: `feat/capsule-E-runtime-runner`.

## Exclusive file ownership

- `backend/runtime/**`
- `backend/runner/**`
- `backend/services/operationService.js`
- `backend/services/checkpointService.js`
- `backend/services/destructiveActionService.js`
- `backend/test/runtime-disk.test.js`
- `backend/test/runtime-network.test.js`
- `backend/test/runtime-qemu.test.js`
- `backend/test/runtime-console.test.js`
- `backend/test/operation-service.test.js`
- `backend/test/runner.test.js`
- `backend/test/reconciliation.test.js`
- `backend/test/checkpoint-service-v2.test.js`
- `backend/test/destructive-actions.test.js`
- `backend/modules/qemuManager.js`
- `backend/modules/guacamoleClient.js`
- `backend/modules/checkpointService.js`

Agent H owns Dockerfile, Compose, package scripts, and final deletion of temporary facades.

## Execution tasks

### Task E1: Safe host ports

Follow master Task 8. Implement one shell-disabled process runner and owned disk/network/QEMU/console services. Test path containment, process identity, TAP/segment ownership, readiness, tokens, and refusal to delete unknown resources.

Run: `cd backend && node --test test/runtime-disk.test.js test/runtime-network.test.js test/runtime-qemu.test.js test/runtime-console.test.js`  
Expected: PASS.

Commit: `refactor: extract capsule runtime services`

### Task E2: Durable runner and reconciliation

Follow master Task 9. Implement PostgreSQL leases, stable steps, lifecycle handlers, retries, cancellation, compensation, restart adoption, PID-reuse protection, and drift classification.

Run: `cd backend && node --test test/operation-service.test.js test/runner.test.js test/reconciliation.test.js`  
Expected: PASS.

Commit: `feat: add durable capsule runner`

### Task E3: Checkpoint and destructive safeguards

Follow master Task 10. Require stopped state, staged digest-verified copies, ownership, quota, fresh impact token, typed instance name, and idempotency.

Run: `cd backend && node --test test/checkpoint-service-v2.test.js test/destructive-actions.test.js`  
Expected: PASS.

Commit: `feat: safeguard capsule state operations`

## Mandatory safety checks

Run:

```bash
rg -n "exec\(|shell:\s*true|PC1|PC2|tap[0-9]" backend/runtime backend/runner backend/services
```

Expected: no unsafe or hard-coded matches.

## Handoff requirements

Provide Agent H the final SHA, runner command, required host capabilities/devices, operation handlers, plan assumptions, reconciliation matrix, facade deletions, Compose requests, and focused output. Append completion evidence here only.

