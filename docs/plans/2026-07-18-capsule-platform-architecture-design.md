# Capsule Platform Architecture Design

**Status:** Approved design  
**Date:** 2026-07-18  
**Scope:** Replace the legacy lab, node, topology, network, and runtime paths with one Capsule-based virtual-lab platform.

## Decision summary

SandLabX will use a staged internal replacement followed by a hard product cutover. Capsules become the only canonical infrastructure model, every runtime VM belongs to a Capsule instance, and no long-lived compatibility or dual-write path remains.

The repository currently contains a Capsule control-plane prototype beside legacy `/api/labs` and `/api/nodes` behavior. Existing Capsule code is implementation evidence to audit, not a final architecture that is accepted without review.

The approved product model is:

```text
Capsule draft -> immutable private or published Capsule version -> Capsule instance
Scenario draft -> immutable Scenario version --------------------^ 
Bundle --------> Capsule version + Scenario versions + portable artifacts
```

- A **Capsule** defines infrastructure: images, workload profiles, nodes, disks, interfaces, links, isolated networks, consoles, resources, bootstrap artifacts, presentation metadata, and policy.
- A **Capsule instance** is one provisioned realization with overlays, QEMU processes, TAPs, segments, consoles, allocations, operations, and observed state.
- A **Scenario** independently defines learning stages, instructions, hints, checks, evidence, scoring, and checkpoint use against a compatible Capsule version.
- A **Bundle** packages independently versioned Capsules, Scenarios, and configuration artifacts without redistributing restricted VM images.

## Product constraints

1. Every VM belongs to a Capsule instance, including single-VM runs.
2. Users can run an unpublished draft without publication ceremony. Run validates the draft and creates a private immutable revision internally.
3. Published versions are required for assignments, stable sharing, reusable Scenarios, and bundles.
4. Editing a draft never mutates an existing instance.
5. QEMU/KVM is the only initial runtime, but workload support is capability-driven and extensible through versioned drivers and profiles.
6. Initial networks are isolated to one Capsule instance. Nodes inside that instance can communicate through authored virtual wiring; internet, host-LAN, physical-interface, cross-instance, and arbitrary host-port connectivity are unavailable.
7. The platform creates virtual hardware and wiring. Guest IP addresses, routes, VLANs, protocols, firewalls, and services remain user configuration unless explicit bootstrap content defines a starting state.
8. Rewiring and NIC changes require stopped nodes initially. Running labs support safe link up/down simulation. Hot-plug is deferred behind proven driver capabilities.
9. Stop/start preserves private VM overlays. Reset restores the initial state; checkpoints restore explicit intermediate states. Destructive actions require impact previews, confirmation, authorization, idempotency, and audit records.
10. No feature is complete until its critical state transitions, failures, retries, and cleanup outcomes are observable.

## Replacement strategy

Use staged replacement with a hard cutover:

1. Inventory every legacy route, module, table, topology shape, UI path, test, command, and documented behavior.
2. Classify each item as retain, refactor behind a port, replace, or delete.
3. Build the canonical model and service boundaries without dual writes.
4. Temporarily adapt proven legacy infrastructure behavior behind new ports where useful.
5. Give every adapter an owner, replacement milestone, and deletion test when introduced.
6. Qualify each new vertical slice with unit, service, API, frontend, failure-injection, and real-host evidence.
7. Cut the product to the new API, schema, UI, and runtime.
8. Drop empty legacy tables and delete adapters, routes, modules, old UI, duplicate docs, and obsolete tests.
9. Add architecture checks that prevent retired dependencies from returning.

Because no labs are populated, the cutover does not require a production data-conversion window. Destructive schema migrations must still check that legacy tables are empty and stop if unexpected data exists.

## Process architecture

SandLabX remains a modular monolith with two runtime processes:

```text
Next.js application
        |
        v
Express API process
  auth, drafts, validation, queries, operation submission
        |
        v
PostgreSQL
  versions, desired state, reservations, operations, events, audit
        |
        v
Single-host runner process
  planning, provisioning, reconciliation, cleanup, verification
        |
        v
QEMU | disks | virtual networks | serial/VNC/Guacamole
```

The API does not mutate host runtime resources. It authenticates and authorizes requests, changes canonical desired state transactionally, submits operation intent, and returns. The runner is the only component authorized to create or remove QEMU processes, disks, TAPs, network segments, and console registrations.

Dependency direction is enforced:

```text
HTTP and UI -> application services -> domain models and ports -> repositories and host adapters
```

Domain and compiler modules cannot import Express, QEMU implementations, or concrete PostgreSQL repositories. Infrastructure modules cannot import HTTP routers.

## Component boundaries

- `CapsuleService`: drafts, validation, normalization, private revisions, publication, compatibility, and export.
- `ScenarioService`: Scenario drafts, publication, Capsule compatibility, checks, evidence policy, and scoring definitions.
- `AssignmentService`: instructor assignments, membership, attempts, and student-instance authorization.
- `BundleService`: portable manifests, members, digests, and image-exclusion policy.
- `ImageService`: immutable image artifacts and versions, provenance, validation, and capture.
- `WorkloadProfileService`: immutable hardware, boot, console, and capability profiles.
- `PlanCompiler`: pure transformation from immutable Capsule, image/profile, host, and policy inputs to an execution plan.
- `AdmissionService`: capability checks, quotas, and atomic reservations.
- `OperationService`: lifecycle intent, idempotency, leases, steps, retries, cancellation, and progress.
- `Runner`: operation execution and reverse-order compensation.
- `ReconciliationService`: desired-versus-observed comparison, adoption, drift reporting, and repair.
- `DiskService`: overlays, checkpoints, restore, capture, validation, and owned cleanup.
- `NetworkService`: private segments, TAPs, MACs, ports, link state, packet-capture seams, and future connector boundaries.
- `QemuProcessService`: argument-array spawn, process identity, readiness, signals, and adoption.
- `ConsoleService`: serial and VNC endpoints, Guacamole registration, authorization, and session audit.
- `VerificationService`: typed checks, bounded guest commands, evidence, scoring, and admin-installed plugins.
- `CapacityService`: host inventory, quotas, reservations, and utilization.
- `ObservabilityService`: structured logging, correlation, redaction, metrics, and audit emission.

Repositories persist state and enforce transaction mechanics but contain no product policy.

## Workload extensibility

QEMU/KVM is implemented first. The core model must not encode router-versus-desktop conditionals. A versioned workload driver and profile describe:

- CPU architecture and acceleration requirements;
- QEMU machine type and version compatibility;
- BIOS, UEFI, secure-boot, and firmware needs;
- disk controllers, media, boot ordering, and backing restrictions;
- NIC models and interface limits;
- serial, VNC, and future console capabilities;
- bootstrap and configuration-export mechanisms;
- readiness, shutdown, and identity probes;
- checkpoint, snapshot, capture, and hot-plug capabilities;
- minimum and maximum resources;
- supported image metadata and qualification evidence.

Future runtime types can implement the same workload and lifecycle ports, but containers and other emulators are outside the first implementation scope.

## Canonical data model

### Authoring and publication

- `capsules`
- `capsule_drafts`
- `capsule_versions`
- `capsule_version_artifacts`
- `scenarios`
- `scenario_drafts`
- `scenario_versions`
- `scenario_capsule_compatibility`
- `bundles`
- `bundle_versions`
- `bundle_members`

Drafts use optimistic concurrency. Private and published versions are immutable normalized documents with schema version, content digest, author, parent, required image/profile versions, compatibility information, and validation evidence.

### Runtime

- `lab_instances`
- `instance_nodes`
- `instance_disks`
- `instance_interfaces`
- `network_segments`
- `network_allocations`
- `console_endpoints`
- `resource_reservations`
- `runtime_observations`

Every runtime resource records an owning instance and, when applicable, an owning node. Host resource names derive from durable identifiers, not labels.

Desired and observed state remain separate. An instance can have desired state `RUNNING` and observed state `DEGRADED` with a structured reason.

### Operations, evidence, and education

- `operations`
- `operation_steps`
- `operation_attempts`
- `instance_events`
- `audit_events`
- `verification_runs`
- `verification_results`
- `artifacts`
- `checkpoints`
- `checkpoint_node_disks`
- `configuration_artifacts`
- `image_capture_operations`
- `assignments`
- `assignment_members`
- `scenario_attempts`
- `scenario_stage_progress`
- `scenario_check_results`
- `scores`

Assignments and attempts pin exact immutable Capsule and Scenario versions. Published changes cannot alter work already in progress.

## Lifecycle and execution

Instances transition through durable operations:

```text
PLANNING -> ADMITTED -> PROVISIONING -> STOPPED -> STARTING -> RUNNING
                                      RUNNING -> STOPPING -> STOPPED
                                      STOPPED -> RESETTING -> STOPPED
                                      any valid state -> DESTROYING -> DESTROYED
```

`DEGRADED`, `RECOVERING`, and `FAILED` describe observed failure and reconciliation outcomes. State changes do not occur as incidental HTTP-handler side effects.

Each mutating plan step declares preconditions, a stable key, idempotency behavior, ownership evidence, success observation, timeout, retry policy, compensation, and emitted events.

The runner leases operations from PostgreSQL. On restart, reconciliation verifies executable identity, arguments, instance/node ownership, disks, TAPs, segments, ports, and console registrations. A PID file alone is never ownership evidence and never authorizes process termination.

## Planning, capacity, and provisioning

The compiler accepts an immutable Capsule revision, exact image and workload-profile versions, host capabilities, policy, and instance identity. It emits an immutable execution plan containing:

- image digests and paths;
- resource requirements and reservations;
- overlays and disk actions;
- exact virtual NICs, MAC addresses, TAPs, and private segments;
- console endpoints;
- QEMU command and argument arrays;
- readiness probes;
- operation steps and compensation;
- ownership labels and cleanup plan;
- semantic and full plan hashes.

Admission atomically reserves vCPU, memory, disk, node, interface, and required port capacity. The initial release does not overcommit CPU or memory. Per-user, per-role, and platform quotas apply. Stopped instances retain storage but release active compute, console-port, and network reservations.

Provisioning stages and atomically publishes disks, creates owned network resources from authored links, starts QEMU with shell execution disabled, verifies identity and readiness, registers consoles, and publishes observed state. Failures compensate in reverse order and never delete resources without verified ownership.

## Virtual networking

Adding a node exposes interfaces declared by its workload profile but connects nothing automatically. Users wire exact interfaces to point-to-point links or shared private Layer 2 segments through the editor, API, or SandLabX CLI.

At launch, the compiler and runner create exactly that virtual patch-panel topology. Guest addressing, VLANs, switching, routing, protocols, firewalls, and services remain user-controlled unless explicit bootstrap artifacts provide an authored starting state.

The first release permits communication only within one Capsule instance and provides no internet egress, host-LAN attachment, physical-interface attachment, cross-instance networking, or arbitrary host-port forwarding. Serial and VNC consoles remain fully available because console transport is separate from lab data networking.

Future external connectors require explicit schema objects, platform policy, administrator approval, admission checks, specialized drivers, and audit evidence.

## Persistence, reset, and reusable starting state

Each instance has private writable overlays. Stop/start preserves guest changes. Reset restores the Capsule's initial state. Named checkpoints preserve explicit intermediate state and require stopped nodes for initial implementation.

Reset and destroy show an impact preview and require typed instance-name confirmation. The server independently verifies authorization, state, ownership, and idempotency.

Reusable starting state has two explicit paths:

1. Versioned configuration artifacts for devices supporting startup configuration, cloud-init, ignition, or another qualified bootstrap mechanism.
2. Explicit capture of a stopped authoring overlay into a newly validated immutable image version.

Runtime changes never mutate a base image or published Capsule. Instance checkpoints are not silently promoted into reusable artifacts.

## Scenario and verification model

Scenarios are independently versioned learning objects compatible with exact Capsule versions or explicitly tested ranges. They define objectives, stages, instructions, hints, starting state, checks, evidence, scoring, and attempt policy.

Verification has three layers:

1. Built-in typed checks for topology, readiness, interface state, reachability, services, files/artifacts, and supported structured workload assertions.
2. Instructor-authored bounded commands executed inside an explicitly designated lab VM through a qualified transport, never on the SandLabX host.
3. Administrator-installed, reviewed, versioned verifier plugins as a future extension point.

Guest commands use argument arrays and explicit targets, with timeout, CPU, output, artifact, redaction, authorization, and audit controls. Scenario-authored host commands are forbidden.

## Authorization

- Admins manage platform policy, images, profiles, host capacity, verifier plugins, and all resources.
- Instructors author and publish Capsules and Scenarios, create assignments, and inspect assigned instances.
- Students instantiate assigned versions, operate their own instances, access their own consoles, create checkpoints within quota, and run checks.
- Students cannot change published topology, images, checks, scoring, or isolation policy.
- Instructor access to a student console is explicit, visible, scoped, and audited.
- Shared group instances are represented as a future capability but deferred until single-owner instances are qualified.

## Editor and dashboard

The backend Capsule draft is the source of truth. The visual editor directly edits canonical nodes, interfaces, links, resources, images, and presentation metadata. Browser storage contains preferences only.

Design mode supports a blank canvas, templates, interface-aware wiring, segments, compatibility filtering, validation, capacity estimates, autosave, optimistic concurrency, and live update events. Run mode displays desired and observed topology, operation progress, node and link state, consoles, capacity, drift, checkpoints, Scenarios, and destructive actions.

Topology changes from the editor, API, or platform CLI update the same draft and notify connected editors. Commands entered inside a guest may change observed state but never rewrite authored physical topology.

## Observability and audit

One shared observability module is used by the API, runner, compiler, migrations, repositories, and infrastructure services. Application code does not use direct `console.*` calls.

Operational logs are structured JSON and carry applicable service, environment, event, request, correlation, operation, instance, Capsule version, Scenario run, node, user, runner, step, attempt, duration, result, error code, and retryability fields.

Three evidence streams remain distinct:

- operational logs for diagnostics;
- durable audit events for security-sensitive actions;
- user-visible instance and operation events for progress and remediation.

Central redaction protects credentials, tokens, cookies, authorization headers, private image URLs, bootstrap secrets, sensitive request fields, console content, and bounded process output. Full request bodies are not logged.

Initial operational logs go to stdout for container collection using a backend-neutral format. Audit state remains durable in PostgreSQL. Metrics cover operation latency and failures, capacity, active VMs, reconciliation drift, and cleanup. Trace-ready correlation is propagated even if a tracing backend is deferred.

Every operation step emits start, success, failure, retry, cancellation, and compensation events. Redaction, correlation, retention, access control, and failure-evidence behavior receive automated tests.

## Failure and security model

Failures use stable codes, safe messages, internal causal chains, retry classifications, and correlation IDs. They are classified as user-correctable, retryable, reconcilable, terminal, or security-sensitive.

Security requirements include:

- shell-disabled argument-array execution;
- strict path containment and identifier/resource validation;
- immutable digest-pinned images with no external backing chains;
- instance-specific filesystem roots;
- isolated internal networks;
- no untrusted host scripts;
- short-lived, instance/node/user-scoped console authorization;
- service-layer RBAC and ownership checks;
- quotas and rate limits;
- central secret redaction and durable audit;
- explicit privileged-mode policy;
- threat modeling before external connectors or executable plugins.

## Qualification and completion gates

Tests cover schema and normalization, deterministic compilation, topology invariants, driver negotiation, allocation uniqueness, state machines, authorization, redaction, bundle integrity, partial cleanup, retries, cancellation, concurrent admission, checkpoint corruption, reconciliation, API workflows, frontend workflows, and destructive confirmation.

A real Linux KVM host must prove multi-node authored wiring, Layer 2 and routed traffic, host/internet isolation, serial and VNC consoles, link simulation, stop/start persistence, checkpoint/reset correctness, restart adoption, compensation without leaked resources, concurrent admission, authorization, and correlated redacted evidence.

Completion additionally requires migration and rollback evidence, Compose validation, security review, backup/restore and upgrade runbooks, critical alerts, supported-configuration documentation, and automated proof that no executable legacy route, manager, table, topology format, hard-coded network path, or temporary adapter remains.

Logging and observability are production-oriented foundations, not sufficient evidence for an unsupported “production ready” claim. Release language must reflect qualified behavior only.
