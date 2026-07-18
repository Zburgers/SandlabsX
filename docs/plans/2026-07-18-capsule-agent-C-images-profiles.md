# Agent C - Image Artifacts and Workload Profiles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Version immutable image artifacts and capability-driven workload profiles while preserving the existing image pipeline's transactional safety.

**Architecture:** Disk content and virtual hardware profiles are independently immutable and versioned. Capsule nodes pin exact versions; no router-versus-desktop conditionals enter the core model.

**Tech Stack:** Node.js 20, QEMU image tooling, QCOW2, PostgreSQL, Node test runner.

---

## Source of truth

- Design workload extensibility: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:111-128`
- Design persistence/capture: `docs/plans/2026-07-18-capsule-platform-architecture-design.md:232-244`
- Master Task 6: `docs/plans/2026-07-18-capsule-platform-replacement.md:311-358`
- Image safety reference: `docs/IMAGE-PIPELINE.md`

Sources of truth are read-only. Send changes to Agent H.

## Dependencies and branch

- Blocked by: Agent A canonical domain/schema commit.
- Blocks: Agent D's final profile-resolution integration and Agent H's image/API composition.
- Follow `docs/plans/capsule-agent-execution-protocol.md`.
- Shared-branch execution is allowed; use `[C]` on every commit subject.
- Optional worktree: `feat/capsule-C-images-profiles`.

## Exclusive file ownership

- `backend/services/imageArtifactService.js`
- `backend/services/workloadProfileService.js`
- `backend/repositories/imageArtifactRepository.js`
- `backend/repositories/workloadProfileRepository.js`
- `backend/test/image-artifact-service.test.js`
- `backend/test/workload-profile-service.test.js`
- `backend/routes/images.js`
- `backend/test/image-api-v2.test.js`
- `backend/modules/imagePipeline.js`
- `backend/cli/sandlabx.js`

Agent H owns `docs/IMAGE-PIPELINE.md`, package scripts, app composition, and Swagger. Provide requested edits at handoff.

## Interface contract checkpoint

Your first commit must publish profile resolution interfaces so Agent D can start:

```js
resolveImageVersion(imageVersionId, client)
resolveWorkloadProfileVersion(profileVersionId, client)
validateNodeOverrides(profile, overrides)
assertImageCompatibility(image, profile, hostCapabilities)
```

Return immutable plain objects; do not expose repository rows.

## Execution tasks

### Task C1: Contract and failing tests

Write tests for immutable versions, capability metadata, permitted overrides, compatibility, provenance, and capture preconditions. Commit only contracts and failing tests if Agent D needs the checkpoint early.

Commit: `test: define image and profile contracts`

### Task C2: Artifact and profile services

Follow master Task 6. Reuse staging, inspection, conversion, validation, digesting, backing-file rejection, atomic publication, and cleanup from `imagePipeline.js` behind the new service.

Run: `cd backend && node --test test/image-artifact-service.test.js test/workload-profile-service.test.js`  
Expected: PASS.

Commit: `feat: version images and workload profiles`

### Task C3: API and CLI boundary

Implement dependency-injected image router and shared CLI commands. Both call services; neither duplicates conversion or validation.

Run: `cd backend && node --test test/image-api-v2.test.js test/tooling.test.js`  
Expected: PASS.

Commit: `feat: expose image profile workflows`

## Handoff requirements

Provide Agent D and H the final SHA, profile/image interfaces, example immutable records, API router factory, CLI changes, migration assumptions, tests, and requested documentation edits. Append completion evidence only to this packet.

## Completion evidence

- Status: REMEDIATION REQUIRED
- Branch and final HEAD: `feat/lab-capsules-scenario-engine` at `9258862` before this evidence commit.
- Commits: `f9605cc [C] test: define image and profile contracts`; `9258862 [C] feat: version images and workload profiles`.
- Owned files changed: `backend/services/imageArtifactService.js`, `backend/services/workloadProfileService.js`, `backend/repositories/imageArtifactRepository.js`, `backend/repositories/workloadProfileRepository.js`, `backend/routes/images.js`, `backend/cli/sandlabx.js`, and their focused tests.
- Contracts exported: `resolveImageVersion(imageVersionId, client)`, `resolveWorkloadProfileVersion(profileVersionId, client)`, `validateNodeOverrides(profile, overrides)`, and `assertImageCompatibility(image, profile, hostCapabilities)` through `createProfileResolutionInterfaces`. All return immutable plain objects or deterministic validation results.
- Example immutable records: image `{ id, name, versionNumber, digest, format, storagePath, sizeBytes, architecture, provenance, metadata, createdAt }`; profile `{ id, name, versionNumber, contentHash, architecture, machine, resources, interfaces, disks, capabilities, supportedImage, permittedNodeOverrides, createdAt }`.
- Tests run and results: initially observed C1 modules and C3 router fail with `MODULE_NOT_FOUND`; then `cd backend && node --test test/image-artifact-service.test.js test/workload-profile-service.test.js test/image-api-v2.test.js test/tooling.test.js` passed (15/15), and `cd backend && npm run check` passed (49/49).
- External/runtime gates: `docker compose config --quiet` passed. `make doctor` found Docker, Compose, Node, QEMU, KVM, TUN, image/overlay/checkpoint directories available, but failed because `vms` and `pids` are not writable; ports 2000/3001/5432/8081 are already in use. Image unit tests use fake QEMU runners and no real disk capture was exercised.
- Known limitations: durable repository adapters require the additive tables `sandlabx_image_artifact_versions` and `sandlabx_workload_profile_versions`; Agent A's accepted `0004`/`0005` migrations do not create them. API factory is intentionally unmounted because Agent H owns application composition. No real disk capture was exercised.
- Requested changes for Agent H-owned files: add an additive migration defining the two immutable version tables (unique image digest; unique profile content SHA-256; version numbers; JSONB provenance/profile metadata; immutable triggers); compose `createImageRouter({ imageArtifacts, workloadProfiles })` under `/api/images/v2`; construct services using the PostgreSQL repositories; document the versioned commands and API routes in `docs/IMAGE-PIPELINE.md`/Swagger.
- Downstream agents unblocked: Agent D can consume the exported contract factory now; final persisted planning/API integration remains blocked on the requested migration and Agent H composition.

## Coordinator acceptance

- Status override: `COMPLETE` after remediation in `05a65c4`, `20c6967`, and `063e847`.
- Agent H added migration `0006_image_profile_versions.cjs`, immutable triggers, schema/legacy-upgrade registration, and disposable-PostgreSQL repository coverage.
- The coordinator fixed monotonically increasing per-name versions in both memory and PostgreSQL adapters, serialized PostgreSQL allocation per artifact/profile name, and added v1/v2 plus concurrent-publication regressions.
- Acceptance evidence: focused C/schema tests pass 6/6; full backend `npm run check` passes 62/62; `npm run db:test-legacy-upgrade` applies migrations `0001` through `0006`, verifies 48 required tables and six Capsule constraints, and preserves adopted legacy data; `git diff --check` passes.
- Remaining composition work belongs to Agent H and does not block Agent D from consuming the accepted resolution contracts.
