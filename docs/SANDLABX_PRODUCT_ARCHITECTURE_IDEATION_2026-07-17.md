# SandLabX Product & Architecture Ideation — July 2026

**Repository:** `Zburgers/SandlabsX`
**Evaluated branch:** `dev/image-pipeline-architecture`
**Current delivery vehicle:** Draft PR #4
**Document status:** Decision-ready product concept and implementation roadmap
**Primary recommendation:** Build **SandLabX Lab Capsules + Scenario Engine**

---

## 1. Executive decision

SandLabX should not add another isolated utility before release.

The strongest next product move is to turn the existing topology editor, lab JSON, QEMU runtime, image pipeline, console access, authentication, and offline `LabSpec` validator into one coherent abstraction:

> **A Lab Capsule is a versioned, portable, executable contract that defines a lab's topology, immutable image inputs, resource requirements, bootstrap configuration, lifecycle, checkpoints, validation checks, instructions, and exported evidence.**

A user should be able to:

1. Design a lab visually or author it as code.
2. Validate it before consuming host resources.
3. See an exact deployment plan and required capacity.
4. Launch it as an isolated lab instance.
5. Watch deterministic progress and recover from failures.
6. Open graphical or serial consoles.
7. Complete tasks or experiments.
8. Run machine-verifiable checks.
9. Reset to a checkpoint.
10. export the complete portable definition without bundling unlicensed vendor images.

This is the most defensible direction because it bridges two categories that are currently separate:

- **Network emulators:** EVE-NG, GNS3, Cisco Modeling Labs, Containerlab.
- **Interactive lab and validation platforms:** Instruqt and netlab validation workflows.

SandLabX can occupy the gap between them:

> **Open, self-hosted, browser-first network and systems labs that are reproducible like infrastructure-as-code and verifiable like a training platform.**

The first release should remain single-host. Multi-host scheduling should be designed as a boundary, not implemented prematurely.

---

## 2. What SandLabX already has

The active development branch is materially stronger than the older PRD implies.

### Existing product primitives

- QEMU/KVM virtual machines.
- QCOW2 base images and per-node overlays.
- Browser VNC through Apache Guacamole.
- Serial console streaming.
- Next.js topology canvas.
- PostgreSQL lab and node state.
- JWT authentication, roles, rate limiting, and audit logging.
- Import/export-oriented lab persistence.
- Custom image upload and conversion.
- A new managed image pipeline with transactional conversion, locking, validation, checksums, and manifests.
- A curated image catalog.
- Deterministic ISO installation planning.
- A new topology-as-code validator and normalizer.
- CLI, host preflight, Makefile, CI, container hardening, and rewritten documentation.

These are enough ingredients for a differentiated product. The problem is that they do not yet compose into a reliable vertical workflow.

### What Draft PR #4 correctly establishes

Draft PR #4 introduces the right foundations:

- safer image lifecycle operations;
- portable image manifests;
- offline lab validation;
- deterministic normalization;
- improved developer tooling;
- stronger runtime defaults;
- documentation that removes unsupported production claims.

Its own follow-up list already points toward the correct next layer: route browser uploads through the managed pipeline, compile lab specs into deployable records, add asynchronous progress, split QEMU responsibilities, and introduce snapshots and portable bundles.

The next phase should turn those follow-ups into one product system rather than separate tickets with separate models.

---

## 3. The core problem: SandLabX currently has multiple meanings of “lab”

The most important architectural gap is not a missing screen. It is semantic fragmentation.

There are currently at least three lab representations.

### A. Canvas topology

The React Flow canvas uses:

- `nodes` as an array;
- `edges` as an array;
- UI positions and UI-specific `data`;
- local browser persistence for positions and edges;
- generic link labels such as `eth0 ↔ eth0`.

This representation is optimized for rendering.

### B. PostgreSQL lab topology

`LabManager` stores another `nodes[] + edges[]` shape in `topology_json`.

It accepts minimal structural validation and later interprets UI fields when starting a lab. Import/export translates between several resource field names and applies defaults.

This representation is optimized for legacy persistence.

### C. New declarative LabSpec

`labSpec.js` uses:

- `schemaVersion`;
- `metadata`;
- `nodes` as a keyed object;
- `links` as an array with explicit endpoints and interfaces;
- deterministic normalization;
- aggregate resource validation.

This representation is optimized for code review and future compilation.

### Why this is dangerous

These are not merely three serializations of one domain model. They contain different semantics.

Consequences include:

- A lab can validate in one path and fail in another.
- UI export is not guaranteed to be runtime-deployable.
- Imported labs may silently receive defaults that change behavior.
- Interface identity can be lost.
- Resource fields are translated through inconsistent names.
- There is no canonical version migration path.
- Runtime state and desired state cannot be compared reliably.
- Git diffs do not necessarily describe what the runtime will execute.

### Required decision

SandLabX needs one canonical, versioned domain schema.

The canvas must become an editor for that schema.
The database must store versions of that schema.
The runtime must consume a compiled plan derived from that schema.
Exports must use that schema.
Validation must evaluate that schema.

---

## 4. The second core problem: links are visual, but networking is hard-coded

The current runtime does not truly compile topology links.

Examples in the current QEMU manager include:

- fixed router TAP interfaces;
- fixed router MAC addresses;
- standard-node TAP assignment inferred from names such as `PC1` and `PC2`;
- bridge behavior encoded in host scripts and naming conventions;
- no persistent interface allocation record tied to a lab instance.

This means the visual canvas can imply arbitrary links, while QEMU launches a small set of predetermined network attachments.

That is a release blocker for the product promise. A topology editor whose links do not authoritatively determine runtime wiring is a diagram tool, not a network lab orchestrator.

### Required replacement

Introduce a deterministic **Network Plan Compiler** and **Network Allocation Service**.

For every lab instance, it must allocate and persist:

- node NIC identities;
- guest-visible interface names;
- MAC addresses;
- host TAP names;
- bridge or point-to-point segment identifiers;
- VLAN tags where applicable;
- optional NAT or external connector bindings;
- optional impairment profiles;
- cleanup ownership.

The compiled plan, not node names, must produce QEMU arguments.

---

## 5. Current architectural gap register

### Critical gaps

| Gap | Current effect | Required correction |
|---|---|---|
| No canonical lab model | Canvas, DB, import/export, and `LabSpec` disagree | One versioned Capsule schema and migration layer |
| Visual links are not runtime-authoritative | User designs can launch with unrelated hard-coded networking | Deterministic topology compiler and network allocator |
| Long operations execute inside HTTP handlers | Uploads, VM starts, and lab starts cannot expose durable progress or safe cancellation | Persisted operation/job model |
| Runtime truth is in an in-memory `Map` | Restart loses process ownership and console state | Reconciliation loop plus durable runtime records |
| Startup cleanup kills PID-file processes | Valid VMs can be destroyed instead of adopted | Verify process identity and reconcile desired/actual state |
| Browser uploads bypass `ImagePipeline` | Two image implementations with different safety properties | One image service used by CLI and API |
| Legacy shell-string QEMU image commands remain | Paths still reach `exec()` in older code paths | Argument-array process runner everywhere |

### High-priority gaps

| Gap | Current effect | Required correction |
|---|---|---|
| API directly orchestrates infrastructure | `server.js` and `LabManager` know too much about QEMU and Guacamole | Application services and operation handlers |
| No definition/version/instance separation | Editing a saved lab and running a lab are conflated | Immutable versions and separate runtime instances |
| No atomic lab deployment | Sequential partial start can leave orphaned nodes | Plan, reserve, execute, compensate, reconcile |
| No host admission control | CPU, memory, disk, ports, and TAP resources can race or overcommit | Capacity snapshots, reservations, quotas |
| No stable workload driver model | Router and desktop behavior is encoded through conditionals | Node drivers/capabilities |
| Database ownership is fragmented | Managers create independent pools and transaction scope is unclear | Shared DB module and explicit transactions |
| No structured migration mechanism | Schema changes risk manual drift | Versioned DB migrations and startup compatibility checks |
| Weak integration testing | Unit helpers do not prove real topology execution | Compiler tests, API tests, failure injection, KVM-host suite |

### Medium-priority gaps

- Canvas edges persist in `localStorage`.
- There is no optimistic concurrency or revision conflict handling.
- Console permissions are not modeled as instance-scoped capabilities.
- Logging is split between Pino and local console wrappers.
- Generated MAC addresses and ports are not durable allocations.
- Backup, RPO, RTO, encryption, and scalability claims in the old PRD are not backed by implementation evidence.
- Image provenance and vendor licensing rules are not product requirements.
- There is no compatibility matrix for machine types, firmware, NICs, console modes, acceleration requirements, or supported image classes.

---

## 6. PRD gap register

The current PRD is useful historical context, but it is no longer a reliable source of truth.

It still describes already-implemented features as planned, reports a stale readiness percentage, and makes a “production grade in five days” conclusion that is not supportable from the runtime architecture.

A replacement PRD must address the following.

### Product strategy gaps

1. **No narrow launch wedge**

   “Network education and enterprise labs” is too broad. These buyers have different requirements, budgets, workflows, and risk tolerances.

2. **No explicit jobs-to-be-done**

   The PRD lists features but does not define the complete job:
   - author;
   - verify;
   - distribute;
   - instantiate;
   - operate;
   - assess;
   - reset;
   - preserve evidence.

3. **No differentiation thesis**

   Open source, visual UI, and custom images are not sufficient by themselves. Mature products already provide combinations of these.

4. **No product boundary**

   It is unclear whether SandLabX is primarily:
   - a network emulator;
   - a general VM lab manager;
   - a classroom platform;
   - a cyber range;
   - a systems testing harness;
   - an appliance development environment.

### Domain-model gaps

- No distinction between lab definition, lab version, lab instance, session, checkpoint, and template.
- No canonical topology schema.
- No lifecycle state machine.
- No desired-state versus observed-state model.
- No operation or event model.
- No artifact model.
- No version compatibility and migration policy.

### Runtime gaps

- No idempotency contract.
- No retry taxonomy.
- No rollback or compensation behavior.
- No cancellation behavior.
- No startup reconciliation behavior.
- No host-loss behavior.
- No partial-deployment UX.
- No network allocation semantics.
- No resource reservation semantics.

### Security and legal gaps

- No threat model for untrusted images or lab definitions.
- No rule for arbitrary bootstrap scripts.
- No egress policy.
- No per-instance network isolation contract.
- No image signature or digest policy.
- No vendor image licensing workflow.
- No secret injection and redaction model.
- No console session authorization model.
- No audit retention and privacy policy tied to real deployment modes.

### Quality gaps

- No measurable launch SLOs derived from actual tests.
- No supported scale envelope for the initial release.
- No workload compatibility test matrix.
- No release qualification suite.
- No disaster-recovery implementation plan.
- No explicit unsupported configurations.
- No upgrade and downgrade policy.

---

## 7. Current market direction

The relevant market is moving in five directions.

### 7.1 Topology-as-code is becoming the control surface

Containerlab treats a topology file as the authoritative definition and derives nodes and links from it. Its “kinds” abstraction encapsulates workload-specific launch behavior.

Cisco Modeling Labs supports YAML-oriented lab workflows and Git-linked lab repositories.

The implication for SandLabX is not “add YAML.” It is:

> The declarative file must be the authoritative contract, while the visual editor is a projection of it.

### 7.2 Validation is moving into the lab definition

netlab can execute validation tests against a running topology and is explicitly suitable for training assignments.

Instruqt structures experiences around setup, check, solve, and cleanup phases.

The opportunity is to make validation a first-class part of a network/VM lab rather than bolt on a generic script runner.

### 7.3 Browser-first multi-user operation is table stakes

EVE-NG, modern GNS3 web UI, and CML all invest in browser workflows, user access, project sharing, snapshots, and administration.

SandLabX cannot differentiate merely by having a Next.js canvas and Guacamole console.

### 7.4 Resource governance is a product feature

CML exposes resource pools and enforces CPU, memory, node, and external connector limits when users launch workloads.

EVE-NG exposes training timers, node limits, and cluster-oriented operational controls.

SandLabX needs preflight admission and reservation before it markets multi-user readiness.

### 7.5 Distributed execution is emerging, but it is not the first milestone

CML clusters distribute labs across compute hosts in enterprise editions.

Containerlab’s Clabernetes work aims to scale topology deployment beyond a single node through Kubernetes.

GNS3 supports multiple computes, although its documentation has historically described manual placement limitations; newer web architecture is evolving.

SandLabX should create a clean runner boundary now, but prove a deterministic single-host engine before building a cluster scheduler.

### 7.6 AI is moving into existing platforms

CML 2.10 introduced MCP integration, and current GNS3 web documentation includes an AI assistant.

Therefore, “AI topology generation” is not a durable standalone differentiator. SandLabX should first produce a trustworthy compiler, state model, and validation engine. AI can later generate or repair Capsules against a strict schema.

---

## 8. Competitor map and the opening for SandLabX

### EVE-NG

**Strengths**

- Mature clientless topology UI.
- KVM-based multi-vendor emulation.
- Multi-user workflows.
- Docker support in paid editions.
- Wireshark capture, timers, link impairments, clusters, and high node limits.

**Weak opening**

- The strongest teaching and operational features are edition-dependent.
- Git-native review and deterministic compilation are not the core product model.
- Automated outcome verification is not the center of the experience.

**Do not compete on**

- Maximum node count.
- Vendor breadth immediately.
- Feature-count parity.

### GNS3

**Strengths**

- Large ecosystem and appliance registry.
- Mature emulator integrations.
- Controller/compute architecture.
- Modern web UI work includes ACLs, snapshots, fault injection, and AI assistance.

**Weak opening**

- Portable, deterministic, image-pinned, reviewable lab contracts are not its primary product identity.
- The experience can still involve significant template and environment setup.
- Distributed compute and portability have historically included operational constraints.

**Do not compete on**

- Ecosystem size.
- Emulator catalog in the first release.

### Cisco Modeling Labs

**Strengths**

- Cisco-supported images and schemas.
- Strong enterprise controls.
- Resource pools and clusters.
- Git-linked sample repositories.
- pyATS integration and modern APIs.
- Packet capture and AI/MCP investment.

**Weak opening**

- Licensing and Cisco-centered commercial positioning.
- Clustering is limited to non-personal product offerings.
- Git repository synchronization is administrator-driven and manual.
- Not an open, vendor-neutral self-hosted foundation.

**Do not compete on**

- Cisco image legitimacy.
- Cisco platform fidelity.
- Enterprise support promises.

### Containerlab

**Strengths**

- Excellent topology-as-code ergonomics.
- Deterministic links and workload “kinds.”
- Fast container-based lifecycle.
- Git and CI-friendly operation.
- Active work on Kubernetes-scale distribution.

**Weak opening**

- CLI-first experience.
- Mostly containerized NOS workflows, despite VM support for selected kinds.
- Not primarily a browser training and console platform.
- Does not own the full VM image, checkpoint, guided scenario, and assessment experience.

**SandLabX advantage**

- Combine browser authoring with a code-first contract.
- Make heavy QEMU system VMs and graphical consoles first-class.
- Add checkpoints and guided verification.

### netlab

**Strengths**

- Strong automation and validation model.
- Training-oriented checks.
- Broad networking automation integration.

**Weak opening**

- Expert-oriented CLI/YAML workflow.
- Not a self-contained browser runtime, image manager, or multi-user console platform.

**SandLabX advantage**

- Make validation approachable in the visual authoring experience.
- Generate checks from structured forms while preserving code reviewability.

### Instruqt

**Strengths**

- Excellent guided lab lifecycle.
- Setup/check/solve/cleanup semantics.
- Learner feedback.
- Track testing.

**Weak opening**

- SaaS-centric general technical training.
- Not a self-hosted multi-vendor network emulation platform.
- General scripts are powerful but create trust and portability concerns.

**SandLabX advantage**

- Network-aware checks, packet evidence, route/interface probes, QEMU appliances, and local ownership.

---

## 9. Ideation funnel

Ideas were scored from 1–5 across strategic fit, differentiation, leverage of existing work, time-to-value, and implementation risk. Higher risk score means safer/easier.

| Idea | Strategic fit | Differentiation | Existing leverage | Time-to-value | Risk | Total |
|---|---:|---:|---:|---:|---:|---:|
| **Lab Capsules + Scenario Engine** | 5 | 5 | 5 | 4 | 4 | **23** |
| Real topology compiler only | 5 | 3 | 5 | 5 | 4 | 22 |
| Packet observability and replay | 4 | 4 | 3 | 3 | 3 | 17 |
| Instructor classroom mode | 4 | 4 | 3 | 3 | 3 | 17 |
| Hybrid VM/container node drivers | 4 | 3 | 3 | 3 | 3 | 16 |
| Distributed runner cluster | 4 | 3 | 2 | 1 | 1 | 11 |
| AI topology copilot | 2 | 2 | 2 | 3 | 2 | 11 |

### Why the winner is broader than “real topology compiler”

The topology compiler is mandatory and should be the first implementation slice. However, exposing it only as internal plumbing misses the larger product identity.

The Lab Capsule gives the compiler a user-facing contract and creates a coherent roadmap for:

- Git workflows;
- repeatable deployment;
- guided labs;
- validation;
- checkpoints;
- sharing;
- future runners;
- future AI generation.

---

# 10. Product concept: SandLabX Lab Capsules

## 10.1 Product promise

> Create a complete, reproducible network or systems environment once; review it in Git; launch an isolated instance from a browser; verify outcomes automatically; reset or export it safely.

## 10.2 Target launch users

### Primary: homelab engineers and small technical teams

They need:

- reusable multi-VM environments;
- browser consoles;
- reproducibility;
- easy sharing;
- no commercial emulator license for the platform itself;
- support for images they are legally entitled to use.

### Secondary: instructors and student cohorts

They need:

- one definition cloned into isolated instances;
- resource limits;
- guided tasks;
- automated checks;
- reset/checkpoint support;
- evidence and completion status.

### Tertiary: network and appliance developers

They need:

- deterministic test topologies;
- bootstrap config;
- network fault profiles;
- CI validation;
- artifacts such as logs and packet captures.

## 10.3 Explicit non-target for the first release

- Large enterprise multi-region cyber ranges.
- Full EVE-NG or GNS3 device catalog parity.
- Unattended execution of arbitrary untrusted scripts.
- Kubernetes orchestration.
- Live migration.
- High availability.
- Vendor image distribution.
- Public multi-tenant SaaS.

---

## 11. Capsule domain model

### 11.1 Definition

A mutable project or draft being edited.

### 11.2 Version

An immutable normalized Capsule document with:

- schema version;
- content hash;
- resolved image references;
- author and timestamp;
- optional signature;
- compatibility metadata.

### 11.3 Instance

A runtime realization of exactly one Capsule version.

Each instance has:

- isolated runtime allocations;
- node runtime records;
- observed state;
- operations;
- checkpoints;
- validation results;
- artifacts;
- owner and access policy.

### 11.4 Session

A user’s interaction with an instance, including console access and task progress.

### 11.5 Operation

A durable asynchronous intent such as:

- validate;
- plan;
- instantiate;
- start;
- stop;
- checkpoint;
- reset;
- verify;
- export;
- destroy.

### 11.6 Execution plan

An immutable, deterministic compilation result containing:

- resolved node drivers;
- image digests;
- resource requirements;
- disk actions;
- network allocations;
- QEMU argument arrays;
- bootstrap actions;
- verification capabilities;
- cleanup actions.

### 11.7 Checkpoint

A named point-in-time set of node disk and optional runtime metadata.

For v1, checkpoints should require nodes to be stopped. Live snapshots can remain future work.

---

## 12. Proposed Capsule schema

Use YAML as the human authoring format and JSON as the normalized API/storage representation.

```yaml
apiVersion: sandlabx.io/v1alpha1
kind: LabCapsule

metadata:
  name: ospf-recovery
  displayName: OSPF Failure and Recovery
  description: Diagnose and restore adjacency after an interface fault.
  tags: [routing, ospf, troubleshooting]

runtime:
  architecture: x86_64
  acceleration: required
  isolation: private
  estimatedDurationMinutes: 45

policy:
  resources:
    maxVcpus: 6
    maxMemoryMiB: 6144
    maxDiskGiB: 40
  network:
    internetEgress: false
    externalConnectors: []
  execution:
    allowAuthorScripts: false

images:
  router:
    source: managed
    name: router
    digest: sha256:REQUIRED_AT_PUBLISH
  workstation:
    source: catalog
    name: ubuntu-24.04
    digest: sha256:REQUIRED_AT_PUBLISH

nodes:
  r1:
    driver: qemu
    image: router
    role: router
    resources:
      vcpus: 1
      memoryMiB: 2048
    interfaces:
      - id: ge0
        model: e1000
      - id: ge1
        model: e1000
    console:
      type: serial
    bootstrap:
      type: serial-config
      source: configs/r1.txt

  r2:
    driver: qemu
    image: router
    role: router
    resources:
      vcpus: 1
      memoryMiB: 2048
    interfaces:
      - id: ge0
        model: e1000
      - id: ge1
        model: e1000
    console:
      type: serial
    bootstrap:
      type: serial-config
      source: configs/r2.txt

  client:
    driver: qemu
    image: workstation
    role: host
    resources:
      vcpus: 2
      memoryMiB: 2048
    interfaces:
      - id: eth0
        model: virtio-net-pci
    console:
      type: vnc
    bootstrap:
      type: cloud-init
      source: cloud-init/client.yaml

links:
  - id: transit
    endpoints: [r1:ge0, r2:ge0]
    type: pointToPoint
    impairment:
      latencyMs: 0
      packetLossPercent: 0

  - id: client-lan
    endpoints: [r1:ge1, client:eth0]
    type: segment

scenario:
  stages:
    - id: baseline
      title: Confirm the failure
      instructions: instructions/01-baseline.md
      checks:
        - id: adjacency-down
          type: command
          node: r1
          commandPreset: show-ospf-neighbors
          assert:
            notContains: FULL

    - id: repair
      title: Restore OSPF adjacency
      instructions: instructions/02-repair.md
      checks:
        - id: adjacency-full
          type: command
          node: r1
          commandPreset: show-ospf-neighbors
          assert:
            contains: FULL
        - id: client-reachable
          type: ping
          from: client
          target: 10.20.0.2
          count: 3
          successPercent: 100

checkpoints:
  - id: initial
    createAfter: bootstrap
    resettable: true

artifacts:
  collect:
    - serialLogs
    - validationReport
    - topologyPlan
  packetCaptures:
    - link: transit
      mode: onDemand
```

### Important schema rule

The published version must not rely on mutable image names alone. It must resolve images to digests and retain a human-readable name as metadata.

---

## 13. Architecture proposal

```text
                         ┌─────────────────────────┐
                         │ Next.js Web Application │
                         │ editor / runs / console │
                         └────────────┬────────────┘
                                      │ HTTP + SSE/WS
                         ┌────────────▼────────────┐
                         │ Express API / BFF       │
                         │ auth, policy, mapping   │
                         └────────────┬────────────┘
                                      │ commands / queries
         ┌────────────────────────────▼────────────────────────────┐
         │                    Control Plane                         │
         │                                                         │
         │ CapsuleRegistry      InstanceService     OperationService│
         │ CapsuleCompiler      AdmissionService    EventService    │
         │ CheckpointService    VerificationService ArtifactService │
         └───────────────┬───────────────────┬─────────────────────┘
                         │ plans             │ durable operations
                 ┌───────▼────────┐   ┌──────▼──────────────────┐
                 │ PostgreSQL     │   │ Single-host Runner       │
                 │ desired state  │   │ reconciliation loop      │
                 │ versions/jobs  │   └──────┬──────────────────┘
                 │ events/results │          │
                 └────────────────┘   ┌──────▼──────────────────┐
                                      │ Execution Services       │
                                      │ QemuProcessService       │
                                      │ QemuDiskService          │
                                      │ QemuNetworkService       │
                                      │ ConsoleService           │
                                      │ ImagePipeline            │
                                      │ VerificationRunner       │
                                      └──────────────────────────┘
```

### 13.1 API layer

Responsibilities:

- authenticate;
- authorize;
- validate request envelopes;
- create commands;
- expose queries;
- stream progress;
- map domain errors.

It must not allocate TAP devices, spawn QEMU, mutate disks, or coordinate multi-step deployment.

### 13.2 Control plane

The control plane owns desired state.

It should:

- store immutable Capsule versions;
- compile plans;
- enforce policy;
- reserve capacity;
- create durable operations;
- emit events;
- determine instance state.

### 13.3 Runner

The first runner is local to the backend host.

It should:

- lease pending operation steps;
- execute idempotent actions;
- report structured progress;
- reconcile observed QEMU, disk, and network state;
- clean only resources it can prove it owns.

A future remote runner can implement the same contract without rewriting product APIs.

### 13.4 Execution services

Refactor the current QEMU manager incrementally behind its public interface.

- **QemuProcessService:** argument construction, spawn, signal, process identity, adoption.
- **QemuDiskService:** overlays, backing chains, checkpoints, cleanup.
- **QemuNetworkService:** TAP, bridge, veth/segment, MAC, port, impairment, teardown.
- **ConsoleService:** serial fan-out and Guacamole registration.
- **ImagePipeline:** imports, catalog pulls, manifests, validation.
- **VerificationRunner:** safe structured probes and restricted adapters.

---

## 14. Operation and reconciliation model

### 14.1 Do not introduce Redis in the first slice

PostgreSQL is already required. A durable operations table with row leasing is sufficient for the initial single-host release.

This avoids expanding operational complexity before the workflow is proven.

A future queue can be introduced behind `OperationService` if measured load requires it.

### 14.2 Operation states

```text
QUEUED
  -> PLANNING
  -> RESERVED
  -> EXECUTING
  -> SUCCEEDED

Any active state
  -> CANCELLING
  -> CANCELLED

Any active state
  -> FAILED
```

Each operation contains child steps with:

- stable step key;
- attempt;
- status;
- start/end time;
- progress;
- structured result;
- structured error;
- compensation status.

### 14.3 Instance states

```text
DRAFT
VALIDATING
INVALID
PLANNED
PROVISIONING
READY
STARTING
RUNNING
DEGRADED
STOPPING
STOPPED
RESETTING
FAILED
ARCHIVED
DESTROYING
DESTROYED
```

### 14.4 Reconciliation

On backend startup and periodically:

1. Load non-terminal instances.
2. Inspect owned PID records.
3. Verify each PID belongs to the expected QEMU command and instance.
4. Inspect TAP/bridge allocations.
5. Inspect overlays and backing chains.
6. Compare desired and observed state.
7. Adopt valid resources.
8. mark drift or enqueue safe repair.
9. Never kill a process solely because a PID file exists.

---

## 15. Network compiler

### Inputs

- normalized Capsule version;
- driver capability catalog;
- current host capacity;
- existing allocations;
- instance ID;
- policy.

### Output

A deterministic network plan:

```json
{
  "instanceId": "inst_123",
  "segments": [
    {
      "id": "transit",
      "hostBridge": "slx-b-4f38e2",
      "type": "pointToPoint"
    }
  ],
  "interfaces": [
    {
      "node": "r1",
      "logicalId": "ge0",
      "guestModel": "e1000",
      "mac": "52:54:00:4f:38:01",
      "tap": "slx-t-4f3801",
      "segment": "transit"
    }
  ]
}
```

### Allocation properties

- deterministic where possible;
- unique within host;
- persisted before QEMU launch;
- idempotent;
- ownership-tagged;
- released only after process and console teardown;
- safe after interruption.

### Initial supported link types

1. `pointToPoint`
2. `segment`
3. `nat`

Defer VLAN trunks, external bridges, overlays across hosts, and advanced fault injection until the base compiler is proven.

---

## 16. Driver model

SandLabX should not encode workload behavior through `if (isRouter)` branches indefinitely.

### Driver contract

```text
validate(node, image, hostCapabilities)
resolveCapabilities(...)
compileDisks(...)
compileNetworkInterfaces(...)
compileConsole(...)
compileProcess(...)
probeReadiness(...)
collectArtifacts(...)
```

### Initial drivers

- `qemu-linux-cloud`
- `qemu-generic`
- `qemu-serial-router`

The current image catalog can declare the compatible driver and required capabilities.

### Future drivers

- `docker`
- `container-nos`
- `remote-ssh`
- `external-connector`

Do not implement all future drivers now. Establish the interface and migrate existing QEMU behavior.

---

## 17. Verification engine

The verification engine is the feature that turns SandLabX from “another emulator UI” into an executable environment platform.

### Safe v1 check types

- `ping`
- `tcpConnect`
- `http`
- `dns`
- `fileExists`
- `serviceState`
- `commandPreset`
- `serialRegex`
- `interfaceState`
- `routeContains`

### Networking-oriented v1.1 checks

- OSPF neighbor state.
- BGP neighbor state.
- Route presence.
- Interface counters.
- VLAN membership.
- Reachability matrix.

### Script policy

- Structured checks are enabled by default.
- Author-provided arbitrary scripts are disabled by default.
- Administrators may opt in for trusted Capsules.
- Script execution uses a restricted environment, timeout, output limits, and secret redaction.
- A public/shared Capsule must declare its required trust level.

### Result model

Every check returns:

```json
{
  "status": "passed",
  "startedAt": "2026-07-17T00:00:00Z",
  "durationMs": 821,
  "expected": {"contains": "FULL"},
  "observed": {"matched": true},
  "evidenceArtifactId": "artifact_123",
  "message": "OSPF adjacency is FULL"
}
```

---

## 18. UX flows

### 18.1 Author flow

1. Create Capsule.
2. Add nodes from image catalog.
3. Draw links.
4. Assign explicit interfaces.
5. Configure resources and console.
6. Add bootstrap config.
7. Add instructions and checks.
8. Run validation.
9. Review capacity and security warnings.
10. Publish immutable version.

### 18.2 Run flow

1. Select a published version.
2. Click **Create instance**.
3. See operation timeline:
   - resolve images;
   - reserve resources;
   - create overlays;
   - wire network;
   - launch nodes;
   - wait for readiness;
   - run bootstrap;
   - create initial checkpoint.
4. Open consoles.
5. Complete tasks or experiment.
6. Run verification.
7. collect artifacts.
8. reset, stop, or destroy.

### 18.3 Failure flow

The user must see:

- exact failed step;
- safe retry availability;
- resources already created;
- resources rolled back;
- unresolved cleanup;
- recommended corrective action;
- operation ID for logs.

“Failed to start lab” is not an acceptable terminal UX.

### 18.4 Git flow

1. Export normalized Capsule directory.
2. Commit it to Git.
3. CI runs schema validation and static compilation.
4. Pull request shows stable normalized diff.
5. On merge, user imports or syncs the version.
6. SandLabX verifies image availability by digest.
7. It never automatically downloads proprietary images unless an authorized source is configured.

---

## 19. Proposed APIs

### Capsule definitions

```http
POST   /api/capsules
GET    /api/capsules
GET    /api/capsules/:capsuleId
PATCH  /api/capsules/:capsuleId
POST   /api/capsules/:capsuleId/validate
POST   /api/capsules/:capsuleId/publish
GET    /api/capsules/:capsuleId/versions
GET    /api/capsule-versions/:versionId
GET    /api/capsule-versions/:versionId/export
```

### Planning and instances

```http
POST   /api/capsule-versions/:versionId/plan
POST   /api/instances
GET    /api/instances
GET    /api/instances/:instanceId
POST   /api/instances/:instanceId/actions/start
POST   /api/instances/:instanceId/actions/stop
POST   /api/instances/:instanceId/actions/reset
DELETE /api/instances/:instanceId
```

### Operations and events

```http
GET    /api/operations/:operationId
POST   /api/operations/:operationId/cancel
GET    /api/operations/:operationId/events
GET    /api/instances/:instanceId/events
```

Use Server-Sent Events for one-way progress streams. Keep WebSockets for interactive serial console traffic.

### Verification and artifacts

```http
POST   /api/instances/:instanceId/verifications
GET    /api/instances/:instanceId/verifications
GET    /api/verifications/:verificationId
GET    /api/instances/:instanceId/artifacts
GET    /api/artifacts/:artifactId/download
```

### Checkpoints

```http
POST   /api/instances/:instanceId/checkpoints
GET    /api/instances/:instanceId/checkpoints
POST   /api/instances/:instanceId/checkpoints/:checkpointId/restore
DELETE /api/instances/:instanceId/checkpoints/:checkpointId
```

---

## 20. Data model

### Core tables

#### `capsules`

- `id`
- `owner_user_id`
- `name`
- `display_name`
- `description`
- `draft_document`
- `revision`
- timestamps

#### `capsule_versions`

- `id`
- `capsule_id`
- `version_number`
- `schema_version`
- `normalized_document`
- `content_sha256`
- `published_by`
- `published_at`
- `signature`
- unique `(capsule_id, version_number)`
- unique `content_sha256` where useful

#### `lab_instances`

- `id`
- `capsule_version_id`
- `owner_user_id`
- `state`
- `desired_state`
- `runner_id`
- `created_at`
- `expires_at`
- `last_reconciled_at`
- `failure_code`
- `failure_detail`

#### `instance_nodes`

- `id`
- `instance_id`
- `logical_node_id`
- `driver`
- `state`
- `observed_state`
- `pid`
- `process_identity`
- `overlay_path`
- `vnc_port`
- `console_registration`
- unique `(instance_id, logical_node_id)`

#### `instance_interfaces`

- `id`
- `instance_node_id`
- `logical_interface_id`
- `mac_address`
- `tap_name`
- `segment_id`
- `allocation_state`

#### `operations`

- `id`
- `type`
- `resource_type`
- `resource_id`
- `state`
- `requested_by`
- `idempotency_key`
- `cancel_requested_at`
- timestamps
- unique scoped idempotency key

#### `operation_steps`

- `id`
- `operation_id`
- `step_key`
- `state`
- `attempt`
- `progress`
- `result`
- `error`
- timestamps
- unique `(operation_id, step_key)`

#### `instance_events`

Append-only event stream for user-visible progress and audit correlation.

#### `checkpoints`

- instance
- name
- manifest
- state
- created time
- parent checkpoint

#### `verification_runs` and `verification_results`

Persist exact Capsule version, check definition, observed evidence, and outcome.

#### `artifacts`

- type
- storage path
- digest
- size
- retention
- redaction state
- owner instance

### Database rules

- Use a shared pool.
- Add migrations.
- Use transactions for definition publication and resource reservation.
- Avoid storing the filesystem as the only truth.
- Avoid storing live process handles in PostgreSQL; store verifiable process identity metadata.
- Use optimistic concurrency on mutable drafts.

---

## 21. Delivery plan

## Phase 0 — Product and model convergence

**Goal:** remove ambiguity before adding runtime features.

Deliverables:

- New PRD based on this document.
- ADR: canonical Capsule schema.
- ADR: definition/version/instance separation.
- ADR: Postgres-backed operations.
- ADR: runner boundary.
- JSON Schema for `v1alpha1`.
- Migration strategy from legacy lab JSON.
- Compatibility matrix for existing images.

Acceptance:

- Canvas export can convert to canonical Capsule.
- Legacy import yields explicit warnings rather than silent semantic changes.
- One normalized fixture produces stable output across runs.

## Phase 1 — Compiler and real networking

**Goal:** make authored links determine runtime wiring.

Deliverables:

- Capsule parser, schema validator, normalizer.
- Driver capability registry.
- deterministic plan compiler.
- network allocation tables.
- QEMU network argument compilation.
- `pointToPoint`, `segment`, and `nat`.
- remove node-name-based TAP behavior.
- compiler unit and integration tests.

Acceptance:

- A three-node topology launches according to its declared links.
- Recompiling the same version produces an equivalent plan.
- No interface is allocated twice.
- A failed launch cleans or records every owned allocation.
- Runtime topology inspection matches the published Capsule.

## Phase 2 — Durable operations and browser integration

**Goal:** make long-running work observable, retryable, and recoverable.

Deliverables:

- operations and steps tables.
- local worker/runner loop.
- SSE progress.
- cancellation.
- startup reconciliation.
- route browser uploads through `ImagePipeline`.
- import/conversion progress.
- operation timeline UI.

Acceptance:

- Browser refresh does not lose operation status.
- Backend restart during provisioning results in adoption or a deterministic failed/retryable state.
- Cancelled image imports leave no published partial image.
- Duplicate requests with the same idempotency key do not duplicate instances.

## Phase 3 — Checkpoints and verification

**Goal:** deliver the first differentiated vertical slice.

Deliverables:

- stopped-VM checkpoint creation and restore.
- structured checks.
- verification UI.
- evidence artifacts.
- initial checkpoint after bootstrap.
- reset-to-initial workflow.

Acceptance:

- A user can launch a sample routing lab, alter it, fail a check, repair it, pass the check, and reset it.
- Restore reproduces the expected disk state.
- Verification results are tied to an immutable Capsule version and instance.
- Unsafe arbitrary scripts remain disabled by default.

## Phase 4 — Scenario authoring and isolated clones

**Goal:** make SandLabX useful for instruction and repeatable team exercises.

Deliverables:

- instructions/stages UI.
- instructor-authored hints.
- per-user instance cloning.
- expiration/timer policy.
- cohort launch with admission limits.
- completion summary.
- portable `.slxlab` bundle format.

Acceptance:

- One Capsule version can produce isolated instances for multiple users.
- No user can open another user’s console without explicit permission.
- Resource limits prevent oversubscription before launch.
- Export does not embed proprietary images by default.

## Phase 5 — Runner abstraction and optional multi-host execution

**Goal:** scale only after the single-host engine is reliable.

Deliverables:

- runner registration and heartbeat.
- capability and capacity reporting.
- scheduling policy.
- image locality awareness.
- cross-host networking design.
- host drain and recovery semantics.

Do not begin this phase until reconciliation and failure recovery are proven on one host.

---

## 22. Sample flagship feature

Build and ship one excellent reference Capsule:

# “OSPF Failure and Recovery Lab”

It should include:

- two router nodes;
- one Linux client;
- a real point-to-point transit link;
- a client LAN;
- pinned image manifests;
- bootstrap configs;
- an intentionally broken OSPF condition;
- guided instructions;
- adjacency and reachability checks;
- serial logs;
- optional packet capture on the transit link;
- initial checkpoint and one-click reset.

This reference lab becomes:

- an end-to-end acceptance test;
- a demo;
- a documentation tutorial;
- a CI fixture;
- a benchmark for launch and reset time;
- proof that the product is more than a canvas.

---

## 23. Metrics and release gates

### Activation

- Time from clean installation to first running reference Capsule.
- Percentage of users who reach a console.
- Percentage of published Capsules that launch successfully.

### Reliability

- Instance provisioning success rate.
- Orphan resource rate.
- Reconciliation repair success rate.
- Percentage of failed operations with actionable structured errors.
- Checkpoint restore success rate.

### Reproducibility

- Plan hash stability.
- Percentage of published versions with all images digest-pinned.
- Drift rate between plan and observed runtime.
- Import/export round-trip fidelity.

### Learning and validation

- Verification run success/failure distribution.
- Time from failed check to successful check.
- Reset usage.
- Completion rate for scenario stages.

### Initial release gates

- No hard-coded node-name networking.
- One canonical schema.
- No browser image conversion outside `ImagePipeline`.
- No long-running provisioning in request handlers.
- Restart reconciliation tested.
- Every runtime resource carries an instance owner.
- Reference Capsule passes full end-to-end suite.
- Unsupported host/image combinations fail at plan time.

---

## 24. Security requirements

### Images

- Never redistribute proprietary vendor images.
- Store source, digest, size, validation state, and compatibility metadata.
- Require users to confirm authorization for restricted images.
- Support image quarantine before validation.
- Prevent backing-file escape.
- Do not mount untrusted guest filesystems on the host by default.

### Capsule content

- Validate all paths against Capsule root.
- Prevent path traversal.
- Disallow arbitrary host commands by default.
- Resolve presets through trusted adapters.
- Mark trust level on imported Capsules.
- Sign or hash published versions.

### Runtime

- Deny external network access unless policy allows it.
- Use per-instance network namespaces or equivalent isolation where practical.
- Treat external connectors as privileged resources.
- Bind console tokens to user, instance, node, and expiry.
- Redact secrets from events, logs, checks, and artifacts.
- Apply size and retention limits to logs and packet captures.

### Operations

- Require idempotency keys on destructive or expensive endpoints.
- Audit requested action and final result.
- Verify ownership before cleanup.
- Make rollback behavior explicit.
- Never infer ownership from a filename alone.

---

## 25. What not to build yet

### Do not build a full Kubernetes control plane

It will consume the project and will not fix current semantic gaps.

### Do not add Redis only because operations are asynchronous

PostgreSQL row leasing is enough for the first reliable implementation.

### Do not build arbitrary shell automation as the main validation feature

It creates a dangerous trust model and weak portability. Start with typed probes.

### Do not add AI generation before the compiler is trustworthy

AI should generate a strict Capsule that can be validated, diffed, and planned. It must never directly improvise QEMU commands.

### Do not chase 1,000-node claims

Define a measured supported envelope based on the target homelab hardware and reference workloads.

### Do not promise production, HA, encryption, RTO, or RPO without tests and operational tooling

Documentation must distinguish implemented, experimental, planned, and unsupported behavior.

### Do not rewrite the entire backend in one PR

Use seams:

1. introduce canonical types and compiler;
2. place execution behind services;
3. migrate one vertical workflow;
4. remove legacy behavior after equivalence tests.

---

## 26. Immediate backlog

### P0 — must happen before feature expansion

1. Freeze a canonical Capsule schema.
2. Add DB migrations.
3. Introduce definition/version/instance entities.
4. Replace name-based network selection with persisted interface allocations.
5. Make browser upload call `ImagePipeline`.
6. replace remaining shell-string QEMU and `qemu-img` execution.
7. Add process identity verification and startup reconciliation.
8. Add end-to-end tests on a real KVM host.
9. Rewrite the stale PRD and status claims.

### P1 — first product slice

1. Plan compiler.
2. Postgres operation model.
3. local runner.
4. SSE progress.
5. reference OSPF Capsule.
6. structured ping and command-preset checks.
7. stopped-VM checkpoint/reset.
8. artifact manifest.

### P2 — after the vertical slice is proven

1. Scenario authoring UI.
2. per-user instance cloning.
3. quotas and expiration.
4. packet capture.
5. Git repository sync.
6. container driver.
7. remote runners.

---

## 27. Recommended branch and PR structure

Do not add this entire roadmap to Draft PR #4.

Finish or stabilize PR #4 as the foundational change, then use focused branches.

### PR A — Canonical model

`feat/capsule-domain-model`

- schema;
- normalizer;
- migrations;
- legacy conversion;
- ADRs;
- fixtures.

### PR B — Network compiler

`feat/capsule-network-compiler`

- allocations;
- driver interface;
- QEMU network plan;
- remove TAP heuristics;
- integration tests.

### PR C — Durable operations

`feat/durable-lab-operations`

- operations tables;
- worker;
- SSE;
- idempotency;
- reconciliation.

### PR D — Image API convergence

`fix/unify-image-pipeline-api`

- API import through `ImagePipeline`;
- progress;
- cancellation;
- remove legacy conversion path.

### PR E — Scenario vertical slice

`feat/scenario-verification-mvp`

- checkpoints;
- checks;
- reference lab;
- UI.

Each PR should be independently testable and avoid carrying an unfinished alternate architecture.

---

## 28. Final positioning

### Weak positioning

“An open-source EVE-NG alternative.”

This invites comparison on feature breadth, device support, scale, and maturity—areas where SandLabX should not compete yet.

### Better positioning

> **SandLabX is a self-hosted platform for executable network and systems labs. Design visually or as code, launch reproducible QEMU environments, verify outcomes, and reset safely from the browser.**

### Product pillars

1. **Reproducible** — immutable versions, image digests, deterministic plans.
2. **Executable** — topology links compile into real runtime wiring.
3. **Recoverable** — durable operations, reconciliation, checkpoints.
4. **Verifiable** — structured checks and evidence.
5. **Portable** — Git-friendly definitions and explicit dependencies.
6. **Self-hosted** — local ownership without requiring a SaaS training platform.

---

## 29. Decision

Proceed with **Lab Capsules + Scenario Engine**, beginning with the canonical schema and real topology compiler.

Do not treat it as one enormous feature. Treat it as the product architecture that organizes the next five focused increments.

The first proof point is simple and non-negotiable:

> A versioned three-node Capsule designed in the browser must produce the same deterministic deployment plan as the CLI, create exactly the declared links, survive a backend restart through reconciliation, run an automated network check, and reset to a known checkpoint.

Once SandLabX can do that reliably, it has a credible foundation for instructors, homelabs, test environments, Git workflows, remote runners, and later AI-assisted authoring.

---

## Research basis

Market comparison was grounded in current official documentation for:

- Cisco Modeling Labs v2.10 release notes, clustering, resource pools, and Git-linked lab repositories.
- EVE-NG feature and edition documentation.
- GNS3 architecture, web UI, compute, appliance, scaling, and access-control documentation.
- Containerlab topology definitions, kinds, deployment lifecycle, and Clabernetes.
- netlab validation documentation.
- Instruqt lifecycle script, challenge, and track testing documentation.

Repository analysis was grounded in the current `dev/image-pipeline-architecture` branch, Draft PR #4, and the relevant backend, frontend, architecture, image, lab, and PRD files.
