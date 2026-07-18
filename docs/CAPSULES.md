# Lab Capsules and Scenario Engine

Lab Capsules are the canonical desired-state model for new SandLabX labs. A Capsule definition is mutable until publication; a published version is normalized, digest-pinned, hashed, and immutable. A lab instance always points to exactly one published version.

## Implemented workflow

1. Author or import JSON with `apiVersion: sandlabx.io/v1alpha1` and `kind: LabCapsule`.
2. Validate and normalize it with the CLI or `POST /api/v2/capsules/:id/validate`.
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
POST /api/v2/capsules
PUT /api/v2/capsules/:id
POST /api/v2/capsules/:id/validate
POST /api/v2/capsules/:id/publish
GET /api/v2/capsules/:id/versions
POST /api/v2/instances
POST /api/v2/instances/:id/actions/:action
GET /api/v2/operations/:id
GET /api/v2/events?after=<cursor>
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

## Cutover and support boundary

`/api/labs`, `/api/nodes`, and `/lab` were removed in the Capsule cutover. Migration `0009_drop_empty_legacy_lab_runtime` aborts if any legacy lab, node, connection, or console-session table contains data.

The API composition and schema cutover are verified. Authenticated Capsule and assignment listings, capacity/admission, desired topology, link-state actions, console grants, checkpoints, impact previews, reset, and destroy routes are mounted. A real KVM provision/start and stopped checkpoint/restore slice has run, but this is not a release-qualified lifecycle: runner results do not publish durable observed state or owned-resource identity, restart does not adopt VMs, reset/destroy cannot reconstruct required inputs, and the console transport URL is not mounted.

Scenario-run HTTP remains unsupported because attempts are not durably persisted. The frontend intentionally retains `CONTRACT_PENDING` for Scenario verification and confirmed impact submission. See `docs/reports/CAPSULE-PLATFORM-QUALIFICATION.md` for the commit-specific blockers.

## Database

Capsule tables are applied by the versioned migration runner at backend startup from `backend/migrations/`. The migration includes definitions, immutable versions, instances, operations, steps/events, verification runs, checkpoints, and artifacts. Existing `/api/labs` records remain available during migration.
