# Capsule legacy replacement ledger

This ledger is an inventory snapshot for the Agent A foundation. It is evidence for later deletion work, not permission to remove legacy behavior in this slice.

| Legacy surface | Classification | Replacement owner | Deletion evidence target |
|---|---|---|---|
| `backend/modules/labManager.js` | replace | CapsuleService | no executable imports after API cutover |
| `backend/modules/nodeManagerPostgres.js` | replace | Instance/Node repositories | instance CRUD and migration tests green |
| `backend/modules/qemuManager.js` | port | QemuProcessService / Runner | runner qualification and ownership-safe reconciliation |
| `backend/modules/qemuManager.js.backup` | delete | none | architecture enforcement reports no backup files |
| `/api/labs` | replace | Capsule API | route inventory excludes legacy endpoints |
| `/api/nodes` | replace | Capsule instance API | route inventory excludes legacy endpoints |
| `sandlabx_labs`, `sandlabx_nodes`, `sandlabx_connections`, `sandlabx_console_sessions` | retain temporarily | additive Capsule migrations | empty-table proof, then destructive migration |
| `frontend/app/lab` | replace | Capsule editor/run UI | frontend route cutover tests |
| `nodes[]` + `edges[]` topology | port | `LabScenario`/Capsule canonical model | no legacy topology at API boundary |
| fixed TAP/MAC/PC1/PC2 behavior | replace | PlanCompiler + NetworkService | allocation uniqueness and no-fixed-name tests |

## Agent A evidence

- `backend/scripts/check-architecture.js inventory` reports legacy imports, direct console calls, and backup files deterministically.
- Pure contracts live under `backend/domain/` and do not import HTTP, PostgreSQL, filesystem, or QEMU modules.
- Additive schema migrations `0004` and `0005` establish draft, Scenario, runtime allocation, reservation, and audit contracts.
- Final deletion remains intentionally deferred to the integration/cutover task.
