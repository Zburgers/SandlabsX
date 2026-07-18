# Capsule platform qualification

## Current status

**REMEDIATION REQUIRED — not release-qualified.**

Software cutover verification passed: backend tests, architecture enforcement, and a disposable PostgreSQL legacy-upgrade migration through `0009` passed. Host preflight also passed on 2026-07-18: Docker, QEMU, KVM, TUN, writable runtime roots, and default ports were available.

The production operation repository now exposes atomic leased execution, durable steps and attempts, cancellation, compensation state, restart lease recovery, and ordered owner events. A separate Compose runner owns KVM/TUN/NET_ADMIN and runtime storage; the API container no longer does. Compiled plans are persisted before admission. Authenticated Capsule/assignment/capacity/topology/checkpoint/console/link-state/impact contracts are mounted, and landed frontend calls no longer use placeholders.

Real-KVM qualification was not run. Scenario execution is not mounted because attempts are not yet durably persisted and no qualified production guest transport is composed. Confirmed destructive actions remain pending in the frontend, and restart-safe process/resource identity publication is not sufficient to prove complete destroy recovery. No managed qualification QCOW2 artifact with pinned provenance was supplied.

Do not release until the two remaining pending contracts, durable Scenario persistence, restart-safe cleanup identity, pinned managed image, guarded qualification fixture, cleanup audit, and `make capsule-qualify` evidence are complete.
