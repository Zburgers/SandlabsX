# Capsule platform qualification

## Current status

**REMEDIATION REQUIRED — not release-qualified.**

Final qualification was performed on 2026-07-19 on branch `feat/lab-capsules-scenario-engine` after Agent 1 commits `b52ba8d`, `3989141`, `7495364`, `2387ed9`, `7acd8d1`, `a4dedfe`, and `3023382`. The bounded qualification fixes are `a9f304e` and `03b1d1e`.

The PostgreSQL operation repository, dedicated Compose runner, persisted plans, authenticated runtime routes, and managed-image pipeline are materially implemented. A two-node Capsule was provisioned and both QEMU processes ran with KVM, instance-owned overlays, an instance-owned bridge, two TAPs, and two console listeners. The full release contract did not pass: state and owned-resource observations are not persisted, restart does not adopt running QEMU processes, Scenario execution is not mounted, destructive operations cannot reconstruct their inputs, the console transport route is absent, and `make capsule-qualify` is still a precondition-only placeholder.

## Managed qualification image

- Upstream: CirrOS `0.6.3`, `cirros-0.6.3-x86_64-disk.img`.
- Source URL: `https://download.cirros-cloud.net/0.6.3/cirros-0.6.3-x86_64-disk.img`.
- Vendor checksum source: `https://download.cirros-cloud.net/0.6.3/SHA256SUMS`.
- Source SHA-256: `7d6355852aeb6dbcd191bcda7cd74f1536cfe5cbf8a10495a7283a8396e4b75b`.
- Release provenance: CirrOS `0.6.3`, source commit `10b1bcdca246864157360cd747a8fe6f7eb1ce81`.
- License metadata: `GPL-2.0-or-later and bundled component licenses`; operators must retain and review the upstream source bundle notices.
- Managed artifact: ignored `images/custom/qualification-cirros-063.qcow2`, imported through `ImagePipeline`.
- Final SHA-256: `38c231fab65191449754070c8f06a42bd7831382fc0d7ebb1b96375ac2c50488`.
- Format and size: standalone QCOW2, 21,692,416 bytes, 117,440,512 virtual bytes.
- `qemu-img info` confirmed `backing-filename: null`, unencrypted, and clean. A direct `-snapshot` KVM boot reached guest userspace and DHCP without mutating the managed base.
- The binary, manifest, overlays, and qualification checkpoints are ignored by Git. `a9f304e` preserves provenance and license fields in ImagePipeline manifests.

## Real lifecycle evidence

The successful authored topology contained two explicitly wired nodes and one private segment.

- Capsule version: `3c538ee2-3a9f-416c-8f08-842da493f486`.
- Instance: `e7e557c9-f278-4a47-9fa1-09c383b1ded6`.
- Persisted plan hash: `sha256:2f94d525117670da20a1ff9aeb07d0671e2c678870355717b444908bba0b4f6e`.
- Provision operation: `7cc739f3-f59e-47ec-a66a-de231fdd7b50`, `SUCCEEDED`.
- Start operation: `575b42ea-558d-4565-ae0b-372bccef963d`, `SUCCEEDED`; two KVM QEMU processes remained alive with `virtio-net-pci` and explicit TAP arguments.
- Runtime network: `br-df64ae888414`, `tap-d8d6c2ac4cf`, and `tap-a7abf0bdca0`, all up in the runner namespace.
- Checkpoint: `f54fac47-252f-45fd-a054-97226f18a776`, `READY`; create operation `380d3654-79d0-4f37-9aed-4b262250e757` and restore operation `3bb80f20-61ce-4a94-b124-9449ccba9c20` both succeeded while stopped.
- Console grants were allocated after `03b1d1e` corrected their ordering query. The returned transport URL produced HTTP 404, so console transport is not qualified.
- Guest packet exchange, routing, and isolation were not proven. Reaching TCP console negotiation is not guest-network evidence.

The persisted instance remained `STOPPED` with desired state `STOPPED`, and no runtime observations or instance events were recorded after start. Restarting the runner terminated both QEMU processes and removed its bridge/TAPs, but left ten active reservations and two allocated console endpoints in PostgreSQL. This is failure to reconcile/adopt, not successful restart recovery.

Reset operation `68500ba8-f505-43e4-acd1-b1cedb01044a` failed because no baseline checkpoint contract reached the runner. Destroy operation `2904629e-554f-4035-aa58-8f67bbb5b249` failed with `OWNED_RESOURCES_REQUIRED`; step results and resource identities were only held in handler closures. Exact qualification reservations and console allocations were then released manually, the instances were marked destroyed, and overlays/checkpoints were moved to ignored, recoverable qualification quarantine directories. Post-cleanup audit found no owned QEMU PIDs, TAPs, bridges, active reservations, or console registrations for these instances.

## Failure and observability evidence

An earlier instance using the compiler's invalid `virtio` device alias reproduced immediate QEMU failure. `03b1d1e` changes the canonical default to `virtio-net-pci`, disables the HTTP health check inherited by the non-HTTP runner, fixes the console query, and makes pre-execution handler failures terminal instead of endlessly re-leasing the operation.

Durable PostgreSQL lease, retry/attempt, cancellation, compensation, stale-lease recovery, and concurrent-capacity behavior have automated disposable-database coverage. They were not all re-proven through destructive real-KVM failure injection in this qualification.

Request logging omitted bodies and did not expose login credentials or tokens. Reset and destroy audit records retained request IDs. Full success/failure correlation is still impossible: successful operations had durable steps but zero user-visible operation events, runtime observations and instance events were absent, and the operation input did not carry the originating request ID through runner execution. Console-grant audit records also lacked request IDs.

## Mandatory blockers

1. `scripts/qualify-capsule-runtime.sh` stops after preconditions with exit 2: `Preconditions passed; real-host fixture execution is not yet implemented.`
2. Scenario attempts remain in memory; no authenticated Scenario execution route returns a canonical durable `ScenarioAttempt`. Frontend `runVerification` remains `CONTRACT_PENDING`.
3. Frontend `confirmImpact` remains `CONTRACT_PENDING`.
4. Runtime resource and process identities, desired/observed node state, link observations, and instance events are not persisted from runner steps.
5. Runner restart kills VMs and does not adopt or reconcile them. Database reservations and console registrations remain allocated.
6. Reset and destroy cannot reconstruct baseline checkpoint or owned-resource inputs and fail through their mounted production routes.
7. Console grants are issued, but the returned console transport route is not mounted.
8. A success and failure cannot be traced across request, operation, runner step, instance event, and audit event with all required correlation IDs.
9. Real guest networking, Scenario verification, failed-step compensation, idempotent retry, and concurrent admission lack one guarded end-to-end qualification fixture.

## Network and gate evidence

Preflight passed Docker, QEMU, KVM, TUN, writable runtime roots, and database connectivity. Four expected port warnings identified the running Compose stack. Pre- and post-cleanup `make network-audit` passed and found no `sandlabx-br0`, `sandlabx-br1`, or legacy subnet; normal startup did not create a fixed legacy bridge.

The final gate results are recorded against the documentation commit that follows this report. All software gates passed: `make prepare`, `make doctor` (18 pass, four occupied-port warnings, zero failures), backend `npm run check`, frontend `npm test` and `npm run build`, `docker compose config --quiet`, `git diff --check`, and `make network-audit`. `SANDLABX_QUALIFICATION_IMAGE=images/custom/qualification-cirros-063.qcow2 make capsule-qualify` failed by design at the placeholder described above. Therefore the platform remains **REMEDIATION REQUIRED**.
