# Capsule Workstation Design

**Status:** Approved

## Outcome

SandLabX opens as a professional network workstation centered on Capsules. The retired standalone-node interface and `/api/nodes` polling are removed from the active product surface. Authors create a Capsule, place exact-version workload nodes, wire declared interfaces, inspect configuration, validate the topology, and create private revisions without leaving the workspace.

## Product shell

Authenticated routes share one stable shell:

- sidebar navigation for Dashboard, Capsules, Scenarios, Assignments, and Images;
- a compact account area and environment status;
- page content that changes without full-document navigation;
- consistent loading, empty, error, and permission states.

The root route redirects to `/dashboard`. The old node dashboard is not adapted to the Capsule API because its standalone-node model conflicts with the approved architecture.

## Capsule workspace

The editor uses a workstation layout:

- top toolbar: name, revision, save state, validation state, undo/redo, validate, and revision actions;
- left palette: searchable workload profiles grouped by network and compute roles;
- center canvas: draggable nodes, interface handles, explicit links, pan, zoom, fit, grid, and minimap;
- right inspector: selected node/link identity, immutable image/profile references, interfaces, resource overrides, and presentation fields;
- bottom activity drawer: validation issues, operation progress, and correlated events.

The visual canvas is authoritative for normal authoring. JSON remains an advanced import/export representation of the same canonical document.

## Node builder and BYOI

`Add node` opens a workstation drawer instead of immediately inserting a hard-coded Router or Host. It supports:

- node identity: display name and stable generated identifier;
- workload type: router, switch, Linux host, or another installed profile capability;
- image source: managed catalog version, existing custom image, URL import where policy permits, or local QCOW2 upload;
- image operation state: checksum/provenance input, validation, conversion, upload/import progress, cancellation, and actionable failure recovery;
- resources: vCPU, memory, disk/overlay sizing, and profile-constrained overrides;
- networking: interface count, stable interface IDs, models, and supported adapter capabilities;
- access: serial, VNC, or other profile-supported console capabilities;
- advanced options: architecture, machine type, boot behavior, and explicitly supported driver overrides.

The node is placed only after image/profile compatibility and override validation pass. BYOI never stores an arbitrary browser path in a Capsule: the image pipeline stages, validates, converts when necessary, computes a digest, publishes an immutable image-artifact version, and the node references that exact version. Upload/import progress remains visible after closing the builder.

## Interaction and persistence

Adding, moving, editing, and wiring nodes first updates local editor state. Persistence is debounced and serialized; only one revision write is in flight. The toolbar displays `Unsaved`, `Saving`, `Saved`, `Conflict`, or `Failed`. Navigation warns when local changes have not been persisted.

Node placement changes presentation metadata. Interface wiring changes canonical topology and must specify exact endpoints. Nodes are never connected automatically.

The client does not poll `/api/nodes`. Runtime and operation changes use the durable `/api/v2/events` cursor contract. A bounded operation poll may be used only as recovery when an event stream disconnects.

## API boundary

All active frontend calls must map to mounted contracts:

- authentication: `/api/auth/*`;
- Capsules and runtime: `/api/v2/*`;
- image/profile resolution: `/api/images/v2/*`.

Unknown, pending, and unavailable capabilities are presented as scoped disabled actions, not global page failures. API errors retain their safe code and request correlation ID.

## Responsive behavior

Desktop uses the full palette/canvas/inspector layout. On narrower screens the palette and inspector become drawers while the canvas remains primary. Keyboard navigation, visible focus, reduced motion, and non-color status indicators are required.

## Verification

Tests cover route compatibility, shell navigation, absence of legacy polling, editor graph conversion, declared wiring, debounced saves, conflict recovery, event cursor resumption, and accessible empty/error states. Production build and a live Compose browser/API smoke gate are mandatory.
