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
- Branch/worktree: `feat/capsule-C-images-profiles`.

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

