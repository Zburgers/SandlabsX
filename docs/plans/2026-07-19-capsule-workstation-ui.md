# Capsule Workstation UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the competing legacy node UI with one coherent, accessible SandLabX workstation centered on a visual, resource-aware Capsule editor.

**Architecture:** Keep the Next.js App Router, Tailwind CSS, React Flow, and existing `/api/v2` control-plane boundaries. A shared authenticated shell owns navigation and product context, while route pages consume typed API functions and reusable workstation components. The Capsule draft remains authoritative: React Flow edits canonical nodes, interfaces, links, resource allocations, and presentation metadata; debounced optimistic saves preserve revisions and surface conflicts without hiding local state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3, React Flow 11, Vitest, Testing Library, Express, Node test runner.

---

## Existing surface audit

- `/` is a legacy standalone-node dashboard that polls `/api/nodes`, opens browser alerts, and exposes a second creation model. It conflicts with the approved Capsule architecture and will become a redirect to `/dashboard`.
- `/dashboard` uses the Capsule API but has no shared shell, instances are always empty, capacity is never loaded, and loading/empty/error states are visually underdeveloped.
- `/capsules` can create a draft, but creation is immediate and opaque; its cards do not expose topology, resource totals, update time, or clear empty/loading states.
- `/capsules/[capsuleId]/edit` renders a list of cards rather than a topology editor. Profiles are hard-coded, resources are missing from new nodes, links cannot be authored, validation is disconnected, and saves have no visible lifecycle.
- `/instances/[instanceId]` exposes lifecycle, consoles, checkpoints, and operations, but the page lacks navigation, hierarchy, topology data, and responsive grouping.
- `/scenarios/[scenarioId]` can render verification evidence, but `/scenarios` does not exist and contract-pending verification is not framed as a scoped capability.
- `/assignments` is placeholder copy despite a mounted authenticated list endpoint.
- `/images` does not exist even though image artifacts and workload profiles are canonical editor inputs.
- `/auth` uses a separate animated purple/cyan visual language, non-deterministic render-time decoration, incomplete labels, and redirects back to the retired root UI.
- `/account/settings` uses the legacy theme and has dead profile-navigation controls.
- There is no shared not-found surface, skip link, stable active navigation, compact mobile navigation, or unified loading/error/permission language.

### Task 1: Establish typed catalogue and workstation API contracts

**Files:**
- Modify: `backend/routes/images.js`
- Modify: `backend/test/image-profile-api.test.js`
- Modify: `frontend/lib/capsule-types.ts`
- Modify: `frontend/lib/capsule-api.ts`
- Modify: `frontend/lib/__tests__/capsule-api.test.ts`

**Step 1: Write failing backend tests**

Add route tests proving authenticated clients can list immutable image artifact versions and workload profile versions without exposing storage-path details not needed by the browser.

**Step 2: Run the focused backend test**

Run: `cd backend && npm test -- --test-name-pattern="image and workload profile catalogues"`

Expected: FAIL because list routes do not exist.

**Step 3: Add catalogue list routes**

Add `GET /api/images/v2/versions` and `GET /api/images/v2/profiles/versions`, backed by the existing service list methods. Preserve the specific `/:id` resolution routes.

**Step 4: Write failing frontend transport tests**

Cover image/profile catalogue loading, capacity loading, Capsule validation, private-revision creation, and assignment listing. Assert `/api/images/v2/*` and `/api/v2/*` paths exactly.

**Step 5: Implement typed API methods**

Extend the canonical types with image catalogue metadata, profile resource/interface bounds, node resources and console preferences, validation issues, assignments, and capacity. Add corresponding methods to `capsuleApi`.

**Step 6: Run focused tests**

Run: `cd frontend && npm test -- lib/__tests__/capsule-api.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add backend/routes/images.js backend/test/image-profile-api.test.js frontend/lib/capsule-types.ts frontend/lib/capsule-api.ts frontend/lib/__tests__/capsule-api.test.ts
git commit -m "feat: expose workstation catalogue contracts"
```

### Task 2: Build the shared SandLabX design system and authenticated shell

**Files:**
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/tokens.css`
- Modify: `frontend/tailwind.config.js`
- Create: `frontend/components/icons.tsx`
- Create: `frontend/components/ui/ActionButton.tsx`
- Create: `frontend/components/ui/StatusSignal.tsx`
- Create: `frontend/components/ui/SurfaceState.tsx`
- Create: `frontend/components/shell/AppShell.tsx`
- Create: `frontend/components/shell/WorkspaceNav.tsx`
- Create: `frontend/components/shell/__tests__/WorkspaceNav.test.tsx`

**Step 1: Write shell accessibility tests**

Test the skip link, semantic navigation, active route state, keyboard-visible mobile menu, account destination, and route labels for Dashboard, Capsules, Scenarios, Assignments, and Images.

**Step 2: Run the shell test**

Run: `cd frontend && npm test -- components/shell/__tests__/WorkspaceNav.test.tsx`

Expected: FAIL because the shell does not exist.

**Step 3: Implement the visual language**

Use Geist Sans and Geist Mono, a graphite/blue-black workstation canvas, cool neutral surfaces, and one restrained cyan-mint accent. Define consistent type, spacing, border, focus, motion, status, and z-index tokens. Remove the purple gradient and render-time animated decoration. Respect `prefers-reduced-motion`, use tabular numerals, and provide 44px primary touch targets.

**Step 4: Implement the shell**

Wrap authenticated product routes with a persistent desktop rail and compact mobile top bar. Show active navigation, environment status, account access, route context, and a skip link. Keep `/auth` outside the authenticated chrome.

**Step 5: Run the shell test**

Expected: PASS.

**Step 6: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/globals.css frontend/tokens.css frontend/tailwind.config.js frontend/components/icons.tsx frontend/components/ui frontend/components/shell
git commit -m "feat: add unified workstation shell"
```

### Task 3: Retire the legacy root surface and redesign primary index pages

**Files:**
- Replace: `frontend/app/page.tsx`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/capsules/page.tsx`
- Create: `frontend/app/scenarios/page.tsx`
- Modify: `frontend/app/assignments/page.tsx`
- Create: `frontend/app/images/page.tsx`
- Create: `frontend/app/not-found.tsx`
- Modify: `frontend/components/capsules/CapsuleList.tsx`
- Modify: `frontend/components/instances/InstanceList.tsx`
- Modify: `frontend/components/capacity/CapacitySummary.tsx`
- Create: `frontend/components/workspace/__tests__/WorkspacePages.test.tsx`

**Step 1: Write route and state tests**

Prove `/` redirects to `/dashboard`; dashboard loads Capsules and capacity without `/api/nodes`; and Capsules, Scenarios, Assignments, and Images render useful loading, empty, success, disabled-capability, and error states.

**Step 2: Run the page tests**

Run: `cd frontend && npm test -- components/workspace/__tests__/WorkspacePages.test.tsx`

Expected: FAIL on missing pages and legacy root behavior.

**Step 3: Implement the route cutover and page hierarchy**

Replace the root client dashboard with a server redirect. Redesign dashboard and list pages around concise page headers, asymmetric operational summaries, clear next actions, searchable catalogues where useful, and honest scoped capability messages.

**Step 4: Run the page tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/app frontend/components/capsules frontend/components/instances frontend/components/capacity frontend/components/workspace
git commit -m "feat: redesign workstation pages"
```

### Task 4: Implement the resource-aware node builder

**Files:**
- Create: `frontend/components/editor/NodeBuilderDrawer.tsx`
- Modify: `frontend/components/editor/NodePalette.tsx`
- Modify: `frontend/components/editor/NodeInspector.tsx`
- Create: `frontend/components/editor/__tests__/NodeBuilderDrawer.test.tsx`
- Modify: `frontend/test/fixtures/canonical-capsule.ts`

**Step 1: Write failing builder tests**

Cover profile selection, image version visibility, stable node ID generation, vCPU/memory bounds, disk allocation, interface count/model, console type, keyboard dismissal, validation feedback, and final canonical node output.

**Step 2: Run the builder test**

Run: `cd frontend && npm test -- components/editor/__tests__/NodeBuilderDrawer.test.tsx`

Expected: FAIL because the drawer does not exist.

**Step 3: Implement the drawer and inspector**

Use progressive sections for identity, workload/image, resources, networking, access, and advanced information. Clamp allocations to installed profile bounds, show aggregate cost before placement, and never place an invalid node. Let the inspector update display name and permitted resource values for an existing selection.

**Step 4: Run the builder test**

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/components/editor frontend/test/fixtures/canonical-capsule.ts
git commit -m "feat: add resource-aware node builder"
```

### Task 5: Replace the card list with an integrated React Flow Capsule editor

**Files:**
- Modify: `frontend/components/editor/CapsuleEditor.tsx`
- Modify: `frontend/components/editor/InterfaceHandle.tsx`
- Modify: `frontend/components/editor/NetworkSegmentNode.tsx`
- Modify: `frontend/components/editor/ValidationPanel.tsx`
- Modify: `frontend/components/editor/RevisionConflictDialog.tsx`
- Create: `frontend/components/editor/CapsuleNode.tsx`
- Modify: `frontend/components/editor/__tests__/CapsuleEditor.test.tsx`

**Step 1: Expand failing editor tests**

Cover blank-canvas onboarding, builder launch, profile-backed node placement, resource persistence, node selection, exact interface connections, duplicate-interface rejection, node movement as presentation metadata, deletion cleanup, undo/redo, zoom controls, validation focus, and read-only behavior.

**Step 2: Run the editor tests**

Run: `cd frontend && npm test -- components/editor/__tests__/CapsuleEditor.test.tsx`

Expected: FAIL on the missing graph interactions.

**Step 3: Implement the workstation editor**

Compose a searchable left palette, central React Flow canvas with grid/minimap/controls, interface handles, right inspector, and bottom validation/activity panel. Translate React Flow nodes/edges to the canonical Capsule document and keep history local. Use non-color indicators for selected, connected, invalid, and unsaved states.

**Step 4: Run the editor tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/components/editor
git commit -m "feat: integrate visual capsule topology editor"
```

### Task 6: Integrate autosave, validation, revisions, and catalogue loading

**Files:**
- Modify: `frontend/app/capsules/[capsuleId]/edit/page.tsx`
- Create: `frontend/hooks/useCapsuleDraft.ts`
- Create: `frontend/hooks/__tests__/useCapsuleDraft.test.tsx`

**Step 1: Write failing persistence tests**

Cover debounced serialized writes, `Unsaved` → `Saving` → `Saved`, failed-save recovery, exact `If-Match` revision use, conflict handling, navigation warning, server validation, profile catalogue loading, private revision creation, and publish action.

**Step 2: Run the persistence tests**

Run: `cd frontend && npm test -- hooks/__tests__/useCapsuleDraft.test.tsx`

Expected: FAIL because the draft controller does not exist.

**Step 3: Implement draft persistence and toolbar integration**

Keep one write in flight, coalesce subsequent local changes, retain failed local state, expose correlation IDs, and reload only on explicit conflict resolution. Load real installed profiles from `/api/images/v2/profiles/versions`; show a clear catalogue-empty state rather than inventing persisted versions.

**Step 4: Run the persistence and editor tests**

Run: `cd frontend && npm test -- hooks/__tests__/useCapsuleDraft.test.tsx components/editor/__tests__/CapsuleEditor.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/app/capsules frontend/hooks
git commit -m "feat: persist capsule workstation revisions"
```

### Task 7: Redesign runtime, scenario, authentication, and account flows

**Files:**
- Modify: `frontend/app/instances/[instanceId]/page.tsx`
- Modify: `frontend/app/scenarios/[scenarioId]/page.tsx`
- Modify: `frontend/components/runtime/RuntimeTopology.tsx`
- Modify: `frontend/components/runtime/NodeControls.tsx`
- Modify: `frontend/components/runtime/CheckpointPanel.tsx`
- Modify: `frontend/components/runtime/ConsoleLauncher.tsx`
- Modify: `frontend/components/operations/OperationStatus.tsx`
- Modify: `frontend/components/scenarios/ScenarioRunner.tsx`
- Modify: `frontend/app/auth/page.tsx`
- Replace: `frontend/app/auth/auth.module.css`
- Modify: `frontend/app/account/settings/page.tsx`
- Modify: `frontend/app/account/layout.tsx`
- Modify: `frontend/app/redirect.tsx`

**Step 1: Write focused interaction and accessibility tests**

Cover runtime action disabled states, checkpoint form labels, console launch status, scenario evidence and contract-pending messaging, auth form names and deterministic rendering, password error announcements, and post-auth `/dashboard` navigation.

**Step 2: Run focused tests**

Run: `cd frontend && npm test -- components/runtime components/scenarios lib/__tests__/auth.test.ts`

Expected: existing tests pass and new assertions fail before redesign implementation.

**Step 3: Apply the shared interaction language**

Use the same shell surfaces, status signals, field treatment, responsive layout, and scoped error patterns. Remove dead settings navigation and keep security behavior intact.

**Step 4: Run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/app frontend/components/runtime frontend/components/operations frontend/components/scenarios
git commit -m "feat: unify runtime and account experiences"
```

### Task 8: Document, verify, update the graph, and publish

**Files:**
- Modify: `frontend/README.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `graphify-out/*` through the graphify updater

**Step 1: Update product and contributor documentation**

Document the `/dashboard` root behavior, shared workstation routes, visual Capsule editing model, profile/image catalogue dependency, resource allocation semantics, save/conflict states, and responsive/accessibility behavior. Remove claims that the standalone node dashboard remains the active frontend.

**Step 2: Run focused and full frontend verification**

Run:

```bash
cd frontend
npm test
npm run build
```

Expected: all Vitest suites pass and Next.js production compilation succeeds.

**Step 3: Run backend and composition verification**

Run:

```bash
cd backend
npm test
npm run check
cd ..
docker compose config --quiet
make doctor
```

Expected: automated tests/checks and Compose config pass. Report missing KVM/TUN or occupied development ports as environment evidence, not UI regressions.

**Step 4: Refresh the repository graph**

Run: `graphify update .`

Expected: graph outputs reflect the new shell, API catalogue methods, and Capsule workstation relationships.

**Step 5: Review and push**

Confirm the original dirty auth files in the source worktree were never included, inspect the branch diff against its parent, then push:

```bash
git push -u origin feat/capsule-workstation-ui
```

**Step 6: Report handoff**

Provide the branch, commits, pushed remote, exact verification results, known host limitations, and any backend capability intentionally shown as unavailable.
