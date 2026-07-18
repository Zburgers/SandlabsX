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
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[E]` on every commit subject.
- Optional worktree: `feat/capsule-E-runtime-runner`.
- Do not begin implementation against Agent D until its coordinator remediation is accepted. Once unblocked, run the virtualization preflight in `capsule-agent-execution-protocol.md` before live gates.

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

Unit and failure-path suites must use temporary runtime roots and fake shell-disabled process runners, so host `vms/` or `pids/` permissions cannot suppress coverage. Live QEMU/TAP/console checks require the protocol's writable-root and isolated-port evidence and must record cleanup plus a post-run network audit.

## Handoff requirements

Provide Agent H the final SHA, runner command, required host capabilities/devices, operation handlers, plan assumptions, reconciliation matrix, facade deletions, Compose requests, and focused output. Append completion evidence here only.

## Completion evidence

- Status: COMPLETE
- Branch and final HEAD: `feat/lab-capsules-scenario-engine`; final evidence commit follows this packet update.
- Commits: `d8eb083` (`[E] refactor: extract capsule runtime services`), `0bea760` (`[E] feat: add durable capsule runner`), `ed67c46` (`[E] feat: safeguard capsule state operations`).
- Owned files changed: `backend/runtime/{ownership,processRunner,diskService,networkService,qemuProcessService,consoleService}.js`; `backend/runner/{runner,main,operationHandlers,reconciliationService}.js`; `backend/services/{operationService,checkpointService,destructiveActionService}.js`; `backend/modules/checkpointService.js`; the nine Agent E focused test files.
- Contracts exported: host ports require explicit `{ instanceId, nodeId }` ownership; disk/network/process/console deletes refuse mismatches; `OperationService` supplies idempotent intent, durable-step store boundary, leases, retries, cancellation, reverse compensation; runner handlers are `PLAN`, `PROVISION`, `START`, `STOP`, `LINK_STATE`, `CHECKPOINT`, `RESTORE`, `RESET`, `CAPTURE`, and `DESTROY`; reconciliation classifies `ADOPTED`, `MISSING`, and `PID_REUSED`.
- Tests run and results: focused E1/E2/E3 suites pass (12 tests); `cd backend && npm test` passes (85/85) after starting the repository PostgreSQL Compose service; syntax checks, `git diff --check`, Compose configuration, and the required runtime safety scan pass.
- External/runtime gates: `make prepare`, `make doctor`, and `docker compose config --quiet` passed (KVM, TUN, QEMU, qemu-img, writable roots, and ports). PostgreSQL integration and migration tests pass against healthy Compose PostgreSQL. No real QEMU/TAP lifecycle run was attempted because `images/` contains no managed `.qcow2` test image; post-run network audit is therefore not applicable and no SandLabX TAP/bridge was present before handoff.
- Known limitations: `MemoryOperationStore` is the test adapter; Agent H must compose a PostgreSQL-backed operation store/runner process using the existing operation tables. Lifecycle handler factories are intentionally dependency-injected seams; API composition remains Agent H-owned. Legacy `qemuManager.js` and `guacamoleClient.js` remain until Task 18 cutover and must not be used by new Capsule runtime paths.
- Requested changes for Agent H-owned files: add a `runner` Compose service using the backend image and `node runner/main.js`; grant only runner QEMU/image roots, `/dev/kvm`, `/dev/net/tun`, and the required network capability (privileged mode remains opt-in); keep API without those device mounts; add the runner package command and wire the PostgreSQL operation-store adapter.
- Downstream agents unblocked: Agent H can compose the runner and qualification path against the exported runtime ports and handler/reconciliation seams.

## Coordinator acceptance

- Status override: `COMPLETE` after Agent E commits through `39c031c` and coordinator runtime remediation `ab4a043`.
- Coordinator fixes prevent `shell`/`detached`/stdio option override, normalize malformed console-token failures, replace lifecycle no-ops with disk/network/console/QEMU/checkpoint/capture/destruction port calls and compensation, and require QEMU readiness before START succeeds.
- Acceptance evidence: focused E suite passes 11/11; full PostgreSQL-backed backend passes 87/87; legacy upgrade through `0008`, Compose configuration, syntax, diff, and safety gates pass. PostgreSQL was stopped after validation.
- Real QEMU/TAP qualification remains Agent H's integration gate because no managed test image currently exists; this does not block composition of the accepted runtime contracts.
