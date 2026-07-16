# Lab Capsules and Scenario Engine

Lab Capsules are the canonical desired-state model for new SandLabX labs. A Capsule definition is mutable until publication; a published version is normalized, digest-pinned, hashed, and immutable. A lab instance always points to exactly one published version.

## Implemented workflow

1. Author or import JSON with `apiVersion: sandlabx.io/v1alpha1` and `kind: LabCapsule`.
2. Validate and normalize it with the CLI or `POST /api/capsules/:id/validate`.
3. Publish it. Publication rejects missing or invalid SHA-256 image digests.
4. Compile a deterministic plan. Declared endpoint interfaces produce instance-scoped MACs, TAPs, segments, console ports, overlay actions, and QEMU argument arrays.
5. Create an instance from the immutable version.
6. Submit lifecycle actions with an idempotency key and observe durable operation events.
7. Run typed checks or create a stopped-VM checkpoint; restore requires a matching owner and stopped instance.

The reference fixture is [examples/capsules/ospf-failure-recovery/capsule.json](../examples/capsules/ospf-failure-recovery/capsule.json). Its example digest is deliberately a placeholder for a managed image the operator is authorized to use.

## CLI

```bash
cd backend
npm run sandlabx -- capsule validate ../examples/capsules/ospf-failure-recovery/capsule.json --published
npm run sandlabx -- capsule normalize ../examples/capsules/ospf-failure-recovery/capsule.json /tmp/ospf-capsule.json
```

## API surface

The authenticated API provides definitions, versions, plans, instances, operations, verification, and checkpoints:

```text
POST /api/capsules
PATCH /api/capsules/:id
POST /api/capsules/:id/validate
POST /api/capsules/:id/publish
GET /api/capsules/:id/versions
GET /api/capsule-versions/:id/export
POST /api/capsule-versions/:id/plan
POST /api/instances
POST /api/instances/:id/actions/{start|stop|reset}
GET /api/operations/:id/events
POST /api/instances/:id/verifications
POST /api/instances/:id/checkpoints
POST /api/instances/:id/checkpoints/:checkpointId/restore
```

Lifecycle actions return `202 Accepted`. Repeated destructive requests with the same owner and `Idempotency-Key` reuse the original operation. If the backend has no configured single-host runner, the operation is durably marked `FAILED` with `RUNNER_UNAVAILABLE`; it never pretends a VM started.

## Safety boundaries

- Images are resolved by digest before planning.
- QEMU commands are argument arrays; no user input is interpolated into shell strings.
- Display labels and canvas positions are presentation metadata and do not alter network allocation.
- Typed checks are limited to topology plans, bounded serial output, and bounded instance artifacts. Arbitrary author commands are disabled by default.
- Evidence is bounded and redacts common credential fields.
- Checkpoints copy through staging and verify SHA-256 before restore.
- Stale PID files are not sufficient evidence to kill a process; QEMU identity is checked first.
- Multi-host scheduling, live snapshots, external connectors, and unrestricted egress remain deferred.

## Database

Capsule tables are applied by the versioned migration runner at backend startup from `backend/migrations/`. The migration includes definitions, immutable versions, instances, operations, steps/events, verification runs, checkpoints, and artifacts. Existing `/api/labs` records remain available during migration.
