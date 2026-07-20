# Capsule Runner Completion Design

**Status:** Approved

## Outcome

SandLabX authors can move freely on the Capsule canvas, import and select managed QCOW2 images, configure bounded node resources, and launch a private test lab directly from the editor. A runtime exposes both whole-lab and per-node lifecycle controls, current desired and observed state, and working node-scoped serial and VNC consoles.

The existing Capsule model remains authoritative. A test run freezes the saved draft into a content-addressed private revision, reusing the same immutable revision when semantic content has not changed. Draft save revisions remain an internal concurrency mechanism and are not presented as product versions.

## Editor responsiveness and persistence

React Flow owns transient node positions while a drag is active. `onNodesChange` updates local canvas state immediately without rebuilding the canonical Capsule document on every pointer event. `onNodeDragStop` commits only the final position to presentation metadata, adds one undo entry, and schedules one serialized draft save.

The editor does not remount after a successful autosave. Save status remains visible, but the draft revision counter moves out of the primary workflow. Presentation-only changes do not create a new runnable semantic revision.

## Test-run workflow

The editor provides one primary `Run lab` action:

1. Wait for pending draft persistence to finish.
2. Validate the saved draft for a private run.
3. Create or reuse its content-addressed private Capsule revision.
4. Create an instance from that exact immutable revision.
5. Provision owned disks, networks, interfaces, and console endpoints.
6. Start all nodes and navigate to the runtime workspace.

Publication remains a separate authoring action. Users do not need to publish a Capsule merely to test its network.

## Lifecycle model

The instance is the ownership and network scope. Bulk controls start, stop, or restart every eligible node. Each runtime node also has independent start, stop, and restart actions.

Node-scoped operations use explicit `nodeId` input and select only that node's persisted plan and owned resources. Bulk actions use the same handlers over all eligible nodes. Invalid transitions are rejected before runner execution, repeated idempotency keys return the original operation, and concurrent lifecycle actions for the same node are serialized.

Provisioning is idempotent and separate from process start. Starting an unprovisioned test instance provisions it first; starting an already provisioned stopped node reuses its owned overlay, TAPs, segments, and console allocation.

## Durable runner state and reconciliation

Only the dedicated runner mutates host resources. Successful steps persist resource identity and observations for disks, bridges, TAPs, QEMU processes, and console endpoints. Instance and node desired/observed states change through declared state transitions and emit durable correlated events.

STOP, RESET, and DESTROY reconstruct their inputs from persisted owned resources rather than in-memory handler closures. After runner restart, reconciliation verifies process command identity and ownership before adoption. Missing resources, PID reuse, partial provisioning, and stale allocations produce explicit drift states; cleanup never deletes an unverified host resource.

## Console transport

Console grants are short-lived, owner-scoped, instance-scoped, node-scoped, and transport-scoped. A grant is useful only for a running node with a matching allocated endpoint.

Serial access uses an authenticated WebSocket bridge to the node's runner-owned serial endpoint and the existing xterm.js frontend. VNC access uses the deployed Guacamole/guacd stack: the backend validates the grant, resolves the persisted node endpoint, creates or resolves a scoped Guacamole connection, and opens the graphical console without exposing host credentials or arbitrary destinations.

Console routes enforce origin, expiry, ownership, endpoint allow-listing, bounded buffering, connection cleanup, and audit correlation. The UI enables only transports supported by the selected workload profile and actually allocated for the node.

## Images and resources

The Images workspace and node builder support managed QCOW2 import through `ImagePipeline`. Browser uploads are staged outside the managed namespace, inspected, checksum-validated when supplied, converted to standalone QCOW2 when needed, atomically published, and recorded as immutable image artifact versions with provenance. Failures and cancellation clean staging data without deleting managed artifacts.

The node builder requires an explicit compatible image version and workload profile. It exposes profile-bounded vCPU, memory, disk, interface, model, and console choices, plus aggregate requested resources and current host capacity. Admission remains authoritative at instance creation/start time because capacity can change after authoring.

## Runtime workspace

The instance page renders every planned node with desired state, observed state, active operation, resource allocation, interfaces, and console actions. It provides `Start all`, `Stop all`, and node-level controls. Durable events update the page; a bounded operation read is recovery only when the event stream disconnects.

Network truth shows declared links alongside observed node/interface state. A user can therefore boot all nodes, stop or restart one node, open its console, and inspect whether the intended network remains functional.

## Branch and integration sequence

The responsive editor and remaining workstation corrections are completed first on `feat/capsule-workstation-ui`, preserving the existing uncommitted collapsible-sidebar change. After focused and full UI verification, that branch is merged into `feat/lab-capsules-scenario-engine` in the main repository worktree. Runner, console, image-import, and real-host qualification work then continues on the integrated Capsule branch.

No VM images, overlays, database data, secrets, generated TypeScript build state, or experimental graph outputs are committed.

## Verification

Automated tests cover transient drag state, one-save-per-drop behavior, test-run revision reuse, instance creation, bulk and per-node transitions, persisted resource identity, restart adoption, PID reuse, failure compensation, console grants/transports, upload cleanup, resource bounds, and event-driven runtime updates.

The real-host gate uses a managed pinned QCOW2 fixture and proves:

- two explicitly connected nodes provision and start with KVM;
- bulk and individual lifecycle controls affect only their intended nodes;
- serial and VNC console sessions connect to the selected node;
- guest traffic crosses the declared network and does not cross undeclared isolation boundaries;
- runner restart adopts verified live processes and preserves usable state;
- stop, restart, and destroy reconstruct persisted resources correctly;
- failed steps compensate safely;
- final cleanup leaves no owned QEMU process, TAP, bridge, reservation, console allocation, or unintended overlay.

Documentation and qualification evidence must state any remaining unsupported behavior without claiming release readiness.
