# Capsule Workstation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken legacy node dashboard and scaffold Capsule pages with a polished, event-driven network workstation backed only by mounted Capsule APIs.

**Architecture:** A shared authenticated App Router shell owns navigation and session state. Client-side Capsule workspace components maintain an editable graph, serialize it to the canonical Capsule document, and persist through a debounced revision queue; durable SSE events update runtime state without page refreshes or legacy polling.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, React Flow, Vitest, Testing Library, Express `/api/v2` contracts.

---

### Task 1: Remove the legacy product entry point

**Files:**
- Replace: `frontend/app/page.tsx`
- Create: `frontend/app/(workspace)/layout.tsx`
- Create: `frontend/components/shell/WorkspaceShell.tsx`
- Create: `frontend/components/shell/WorkspaceNav.tsx`
- Test: `frontend/components/shell/__tests__/WorkspaceShell.test.tsx`

1. Write a failing shell test that asserts Capsule navigation and excludes standalone `Add Node` controls.
2. Run `cd frontend && npx vitest run components/shell/__tests__/WorkspaceShell.test.tsx`; expect failure because the shell does not exist.
3. Replace `/` with an App Router redirect to `/dashboard`; implement one authenticated shell for workspace routes using `Link` and `usePathname`.
4. Move Dashboard, Capsules, Instances, Scenarios, Assignments, and account routes under the workspace route group without changing their public URLs.
5. Delete active imports of `apiClient.listNodes`, `setInterval`, legacy `NodeCard`, and standalone `CreateNodeModal` from route code.
6. Run the focused test and `rg -n '/api/nodes|setInterval' frontend/app frontend/components`; expect no active route matches.
7. Commit with `refactor(frontend): replace legacy node dashboard shell`.

### Task 2: Harden the canonical API and session boundary

**Files:**
- Modify: `frontend/lib/capsule-api.ts`
- Modify: `frontend/lib/auth.ts`
- Modify: `frontend/hooks/useAuth.ts`
- Test: `frontend/lib/__tests__/capsule-api.test.ts`
- Test: `frontend/lib/__tests__/auth.test.ts`

1. Add failing tests for mounted route families, JSON content-type handling, correlation IDs, and a single session verification request.
2. Run both focused test files and verify failure.
3. Centralize response parsing and authorization headers; never clear a session for non-401 failures.
4. Preserve `/api/auth/me`, `/api/v2/*`, and `/api/images/v2/*` as separate explicit boundaries.
5. Add a session provider so each route does not independently call `/api/auth/me` after navigation.
6. Run focused tests and commit with `fix(frontend): align workspace with canonical APIs`.

### Task 3: Build the workstation frame

**Files:**
- Create: `frontend/components/workstation/WorkstationToolbar.tsx`
- Create: `frontend/components/workstation/NodePalette.tsx`
- Create: `frontend/components/workstation/InspectorPanel.tsx`
- Create: `frontend/components/workstation/ActivityDrawer.tsx`
- Modify: `frontend/app/globals.css`
- Test: `frontend/components/workstation/__tests__/WorkstationFrame.test.tsx`

1. Write a failing accessibility test for toolbar landmarks, searchable palette, inspector, activity region, focus labels, and non-color save status.
2. Implement the responsive desktop frame and drawer behavior with the existing design tokens.
3. Use restrained navy/slate surfaces, cyan primary actions, violet selection, compact typography, and no decorative emoji as primary iconography.
4. Add loading skeletons and useful empty/error states.
5. Run the test and commit with `feat(frontend): add capsule workstation frame`.

### Task 4: Implement the real topology canvas

**Files:**
- Replace: `frontend/components/editor/CapsuleEditor.tsx`
- Create: `frontend/components/editor/CapsuleCanvas.tsx`
- Create: `frontend/components/editor/CapsuleNode.tsx`
- Create: `frontend/lib/capsule-graph.ts`
- Modify: `frontend/components/editor/__tests__/CapsuleEditor.test.tsx`
- Test: `frontend/lib/__tests__/capsule-graph.test.ts`

1. Write failing tests converting canonical nodes/links to React Flow nodes/edges and back without changing semantic references.
2. Test explicit source-interface to target-interface wiring and rejection of reused or unknown endpoints.
3. Implement draggable nodes, interface handles, declared edges, selection, deletion, pan/zoom, fit view, controls, grid, and minimap.
4. Keep positions under presentation metadata and links under canonical `links`.
5. Run tests and commit with `feat(frontend): author capsule topology visually`.

### Task 5: Restore the configurable node builder and BYOI

**Files:**
- Create: `frontend/components/editor/NodeBuilder.tsx`
- Create: `frontend/components/editor/ImageSourcePicker.tsx`
- Create: `frontend/components/editor/ResourceOverrides.tsx`
- Create: `frontend/components/editor/InterfaceBuilder.tsx`
- Create: `frontend/hooks/useImageImport.ts`
- Modify: `frontend/lib/capsule-api.ts`
- Modify: `frontend/components/editor/CapsuleEditor.tsx`
- Test: `frontend/components/editor/__tests__/NodeBuilder.test.tsx`
- Test: `frontend/lib/__tests__/capsule-api.test.ts`

1. Write failing tests for naming a node, selecting an exact managed image/profile, choosing an existing custom image, configuring allowed resources/interfaces/consoles, and rejecting incompatible overrides.
2. Write a failing BYOI test covering local upload/import progress, checksum/provenance input, cancellation, validated immutable artifact resolution, and final node placement.
3. Run the focused tests; expect failure because the builder and landed image-job boundary do not exist.
4. Implement one `Add node` action that opens a responsive drawer with `Identity`, `Image`, `Resources`, `Networking`, and `Advanced` sections.
5. Populate choices from backend image-artifact and workload-profile contracts; remove hard-coded fake digests and profile versions from the edit page.
6. Route BYOI through ImagePipeline asynchronous jobs. If the backend image-job/upload endpoints are not mounted, implement and test that bounded backend contract before enabling the UI; do not point the new UI at deleted `/api/images` routes.
7. Keep upload/import progress in the activity drawer and allow the editor to close without cancelling unless the user explicitly requests cancellation.
8. Place a node only after the server returns exact compatible artifact/profile versions and override validation succeeds.
9. Run focused tests and commit with `feat(frontend): add configurable capsule nodes`.

### Task 6: Add serialized debounced persistence

**Files:**
- Create: `frontend/hooks/useCapsuleDraft.ts`
- Create: `frontend/lib/revision-save-queue.ts`
- Modify: `frontend/app/capsules/[capsuleId]/edit/page.tsx`
- Test: `frontend/lib/__tests__/revision-save-queue.test.ts`
- Test: `frontend/components/editor/__tests__/CapsuleEditor.test.tsx`

1. Use fake timers to write failing tests proving rapid edits produce one save, saves never overlap, and the latest document persists after an in-flight response.
2. Add tests for conflict state and explicit reload/reapply behavior.
3. Implement a 600–900 ms debounce followed by a serialized revision queue.
4. Expose `Unsaved`, `Saving`, `Saved`, `Conflict`, and `Failed` states to the toolbar.
5. Do not reload the route after successful saves.
6. Run tests and commit with `fix(frontend): serialize capsule draft persistence`.

### Task 7: Replace polling with durable events

**Files:**
- Modify: `frontend/lib/event-stream.ts`
- Create: `frontend/hooks/useOperationEvents.ts`
- Modify: `frontend/app/instances/[instanceId]/page.tsx`
- Test: `frontend/lib/__tests__/event-stream.test.ts`

1. Write failing tests for named SSE events, numeric cursor resumption, deduplication, reconnect backoff, and cleanup on unmount.
2. Implement one scoped event subscription per active runtime view.
3. Update operation and observed-state UI without `router.refresh`, `window.location`, or periodic node polling.
4. Run tests and commit with `feat(frontend): stream durable runtime updates`.

### Task 8: Polish Capsule discovery and empty states

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/capsules/page.tsx`
- Modify: `frontend/components/capsules/CapsuleList.tsx`
- Test: `frontend/components/capsules/__tests__/CapsuleList.test.tsx`

1. Write failing tests for a useful first-Capsule workflow, recent drafts, status metadata, and navigation into the editor.
2. Add a composed dashboard with recent Capsules, host capacity, active operations, and guided first steps.
3. Redesign the Capsule list with search, status filters, revision details, modified time, and strong empty state.
4. Replace `window.location.assign` with `router.push` or `Link`.
5. Run tests and commit with `feat(frontend): polish capsule workspace discovery`.

### Task 9: Final compatibility and live qualification

**Files:**
- Modify: `frontend/README.md`
- Modify: `docs/CAPSULES.md`
- Modify: `docs/issues.md`

1. Add a route-contract test that fails on active `/api/nodes`, `/api/labs`, or unmounted `/api/capsules` calls.
2. Run `cd frontend && npm test && npm run build`.
3. Run `cd backend && npm run check` and `docker compose config --quiet`.
4. Rebuild frontend/backend/migrate images and start the Compose stack.
5. Smoke login, `/api/auth/me`, Capsule listing/creation/edit/save, managed-image selection, custom-image upload/import progress, and verify logs contain no `/api/nodes` requests.
6. Record the retired legacy frontend and resolved refresh issue in `docs/issues.md` and update user-facing Capsule instructions.
7. Run `git diff --check`; preserve `graphify-out/` untracked.
8. Commit with `docs: record capsule workstation cutover`.
