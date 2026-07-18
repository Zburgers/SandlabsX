# Capsule legacy replacement ledger

This is the deterministic Agent A inventory for the hard Capsule cutover. It records current debt; it does not authorize deletion before the Task 18 preflight confirms that legacy tables are empty.

| Legacy surface and exact reference | Classification | Target component / owner | Temporary adapter | Target milestone | Deletion evidence |
|---|---|---|---|---|---|
| `backend/modules/labManager.js` (`LabManager`) | replace | `CapsuleService` / Agent H | none | Task 18 cutover | architecture enforcement has no `LabManager` import |
| `backend/modules/nodeManagerPostgres.js` | replace | instance repositories / Agent H | none | Task 18 cutover | architecture enforcement has no standalone-node import |
| `backend/modules/qemuManager.js` | port | `QemuProcessService` / Agent E | `legacyQemuManagerAdapter` only if introduced and listed here | Task 10–18 | runner integration owns all process calls; no direct host mutation in API |
| `backend/modules/qemuManager.js.backup` | delete | none | none | Task 18 | file absent and checker `backupFiles` empty |
| `backend/server.js` registrations under `/api/labs` | replace | Capsule API / Agent H | none | Task 18 | route inventory and Swagger have no `/api/labs` |
| `backend/server.js` registrations under `/api/nodes` | replace | Capsule instance API / Agent H | none | Task 18 | route inventory and Swagger have no `/api/nodes` |
| `backend/swagger.js`, `backend/modules/postman.json`, `backend/README.md` legacy routes | replace | API docs / Agent H | none | Task 18 | docs/API search has no executable legacy endpoint |
| `sandlabx_labs` in `0001_core_schema.cjs` | retain then delete | final schema / Agent H | none | Task 18 | count preflight is zero before destructive migration |
| `sandlabx_nodes` in `0001_core_schema.cjs` | retain then delete | `instance_nodes` / Agent E | none | Task 18 | count preflight is zero and foreign keys removed only afterward |
| `sandlabx_connections` in `0001_core_schema.cjs` | retain then delete | `network_segments` and `network_allocations` / Agent E | none | Task 18 | count preflight is zero |
| `sandlabx_console_sessions` in `0001_core_schema.cjs` | retain then delete | `console_endpoints` / Agent E | none | Task 18 | count preflight is zero |
| `frontend/app/lab`, legacy canvas components, browser topology state | replace | Capsule editor / Agent F | none | Task 16–18 | frontend routing and browser-storage audit are clean |
| `nodes[]` / `edges[]` in `backend/modules/labManager.js`, `server.js`, plan/docs | port | `legacyCapsuleSchemaAdapter` / Agent A | `legacyCapsuleSchemaAdapter` | Task 3 then Task 18 deletion | no legacy topology reaches Capsule API; adapter removal test |
| `topology_json` / `topologyJson` legacy persistence | replace | Capsule drafts and versions / Agent B | none | Task 18 | repository query audit has no legacy topology source |
| fixed `tap0`–`tap3`, `PC1`, `PC2` in `qemuManager.js`, `qemu-ifup`, `qemu-ifdown`, setup scripts | replace | `NetworkService` / Agent E | none | Task 10–18 | compiler/runtime tests prove instance-owned names only |
| `backend/setup-network.sh`, `scripts/setup-network-lab.sh`, `scripts/test-pc1-connectivity.sh`, `scripts/test-router.sh` | delete/replace | runner and qualification scripts / Agent E | none | Task 18 | scripts removed or renamed to Capsule qualification scripts |
| `backend/migrate-nodes.js`, `backend/modules/nodeManager.js` | delete | Capsule persistence / Agent H | none | Task 18 | no standalone-node migration/manager path remains |
| `backend/middleware/rbac.js` standalone-node checks | replace | Capsule authorization / Agent H | none | Task 14–18 | service-layer ownership checks cover Capsule instances |
| `docs/ARCHITECTURE.md`, `docs/STARTUP-RUNTIME.md`, `docs/CAPSULES.md`, historical PRD/archive references | replace/archive | docs / Agent H | none | Task 18 | active docs describe only Capsule paths; historical docs remain explicitly archived |
| `backend/test/planCompiler.test.js` fixed-network expectations and legacy fixture conversions | replace | Capsule compiler tests / Agent D | `legacyCapsuleSchemaAdapter` only for conversion tests | Task 8–18 | no fixed TAP/MAC/PC naming remains in active tests |

`backend/scripts/check-architecture.js` inventories imports, routes, topology, fixed network names, shell-string execution, backup files, direct `console.*`, and direct host mutation. Inventory mode records debt; enforcement mode must fail until Task 18 removes all non-temporary entries.

## Completion evidence

- Status: PARTIAL CUTOVER COMPLETE; runtime qualification remains blocked.
- Deletion evidence: migration `0009_drop_empty_legacy_lab_runtime` checks all four legacy table counts before dropping them; `backend/test/legacy-cutover.test.js` proves legacy modules are absent and architecture enforcement has no legacy debt.
- Retained platform primitives: `ImagePipeline`, lab-spec CLI validation, and Capsule runtime services remain; they are not legacy HTTP/runtime facades.
- Blocking evidence: production `OperationRepository` does not implement the `Runner` lease/step-execution persistence contract, so real-host runtime qualification and runner Compose deployment are not safe to claim.
