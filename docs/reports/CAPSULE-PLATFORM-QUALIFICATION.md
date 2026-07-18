# Capsule platform qualification

## Current status

**REMEDIATION REQUIRED — not release-qualified.**

Software cutover verification passed: backend tests, architecture enforcement, and a disposable PostgreSQL legacy-upgrade migration through `0009` passed. Host preflight also passed on 2026-07-18: Docker, QEMU, KVM, TUN, writable runtime roots, and default ports were available.

Real-KVM qualification was not run. The composed production operation repository exposes durable create/read/cancel/event behavior but not the runner lease and step-execution contract required by `Runner`. The unmounted frontend runtime capabilities consequently have no safe production route contract. No managed qualification QCOW2 artifact with pinned provenance was supplied.

Do not release until the runner persistence contract, runtime routes, pinned managed image, guarded qualification fixture, cleanup audit, and `make capsule-qualify` evidence are complete.
