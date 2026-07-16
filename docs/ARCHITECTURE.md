# SandLabX architecture

## Design goals

SandLabX should remain understandable while it grows from a single-host lab manager into a reusable virtualization platform. New code should preserve four properties:

1. Image and VM operations are recoverable after interruption.
2. User-controlled values never become shell command strings.
3. HTTP routes coordinate domain services rather than implementing infrastructure logic.
4. Lab definitions and image metadata remain portable outside the database.

## Runtime components

### Frontend

Next.js and React provide dashboard, topology, authentication, and console workflows. The frontend communicates with the backend API and embeds Guacamole for graphical consoles.

### API

Express handles authentication, RBAC, rate limiting, request validation, and response mapping. Route handlers should stay thin and delegate to domain services.

### Domain services

- `NodeManager`: node persistence and lifecycle state
- `LabManager`: lab ownership and topology persistence
- `QemuManager`: existing VM process orchestration
- `ImagePipeline`: image inspection, conversion, validation, catalog download, manifests, compaction, and resizing
- `LabSpec`: offline topology validation, normalization, and ISO installer planning
- `CapsuleSchema`: canonical versioned desired-state validation, normalization, hashing, and legacy conversion
- `CapsuleRepository`: immutable publication and owner-scoped definition/version persistence
- `PlanCompiler`: deterministic instance-scoped network, disk, console, and QEMU argument plans
- `VerificationRunner`: typed, bounded, redacted scenario evidence
- `CheckpointService`: staged stopped-VM disk checkpoints with digest-verified restore
- `GuacamoleClient`: graphical console registration

### Virtualization

QEMU runs each VM as an isolated process. Base images are immutable and VM writes go to per-node QCOW2 overlays. KVM is preferred; TCG is a compatibility fallback.

## Image transaction model

An image import is a transaction:

1. Validate the source path.
2. Acquire a per-image lock.
3. Optionally verify the source SHA-256.
4. Inspect source metadata with `qemu-img info --output=json`.
5. Convert into a unique staging file using argument arrays and `shell: false`.
6. Validate the staged QCOW2 file.
7. Reject encrypted images and external backing files.
8. Atomically rename the staged file into the managed image directory.
9. Atomically write its manifest.
10. Remove staging and lock files in `finally` cleanup.

This prevents partial files, command injection, duplicate writes, and invisible backing-file dependencies.

## Declarative lab model

A lab spec has four top-level fields:

```json
{
  "schemaVersion": 1,
  "metadata": {},
  "nodes": {},
  "links": []
}
```

Validation checks referential integrity, interface exclusivity, resource bounds, self-links, and aggregate resource budgets. Normalization sorts nodes, links, and tags for stable Git diffs.

## Compose reliability

The Compose stack waits for PostgreSQL health before starting dependent services. Services have restart policies and bounded logging. The backend receives a graceful shutdown window and legacy privileged mode is opt-in.

## Extraction roadmap

`qemuManager.js` still contains multiple responsibilities. The intended split is:

```text
QemuProcessService   spawn, signal, PID recovery, status
QemuDiskService      overlays, snapshots, backing chains
QemuNetworkService   TAP, bridges, MAC allocation, port allocation
ConsoleService       serial fan-out and Guacamole registration
ImagePipeline        managed base-image lifecycle
```

The next refactor should preserve existing public methods while delegating to these services incrementally.

## Capsule control plane

```text
Capsule JSON -> schema/normalizer -> immutable version -> plan compiler
                                      |                    |
                                      v                    v
                                PostgreSQL           single-host runner boundary
                                      |                    |
                                      v                    v
                           instance/operation/events   QEMU/disk/network/console
```

The Express Capsule router performs ownership and request mapping only. It does not allocate host devices or build shell commands. Lifecycle actions are durable operation intents; a missing runner is reported as `RUNNER_UNAVAILABLE` rather than treated as a successful launch.
