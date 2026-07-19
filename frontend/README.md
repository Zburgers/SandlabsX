# SandLabX frontend

The SandLabX web application is a task-oriented workstation built with Next.js 15, React 19, TypeScript, Tailwind CSS, React Flow, and xterm.js. Its shared shell brings Capsule authoring, assignments, images, scenario execution, live instances, and account controls into one consistent interface.

## Development

```bash
cd frontend
npm install --no-audit --no-fund
npm run dev
```

The development server listens on `http://localhost:2000`. The production container continues to listen on port `3000` internally; Docker Compose publishes it at `http://localhost:2000` by default.

Production compilation:

```bash
npm run build
npm start
```

The Dockerfile uses Next.js standalone output and runs the production server as an unprivileged user.

## Configuration

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GUAC_URL=http://localhost:8081/guacamole
```

These values are injected by Docker Compose for the standard local stack.

## Project structure

```text
frontend/
├── app/          Next.js routes, layouts, and global styles
├── components/   Dashboard, canvas, node, modal, and console components
├── hooks/        Reusable client-side state and lifecycle hooks
├── lib/          API client, shared types, and utilities
├── public/       Static assets
├── Dockerfile    Standalone production build
└── next.config.js
```

## Main product surfaces

- **Dashboard:** recent Capsules, assignments, images, and clear next actions
- **Capsule workspace:** searchable drafts and a visual authoring canvas at `/capsules`
- **Visual topology editor:** drag-and-drop nodes, interface-to-interface links, minimap, zoom controls, undo/redo, validation, and a live activity rail
- **Resource-aware node builder:** profile and compatible image selection with bounded vCPU, memory, disk, interface, and console configuration
- **Images:** backend-sourced profile, artifact, and immutable-version catalogues
- **Assignments and scenarios:** consistent preparation, run, and evidence workflows
- **Serial console:** xterm.js-based terminal access
- **Graphical console:** Guacamole-backed browser sessions
- **Authentication and account:** deterministic sign-in, registration, session protection, and account settings
- **Instance runtime:** desired/observed topology, operation status, checkpoints, and scoped-console launch at `/instances/:instanceId`

## API integration

The API client under `lib/` should remain the only place that knows backend URL construction and transport details. UI components should consume typed functions rather than construct `fetch` calls directly.

Backend endpoint groups currently include:

- `/api/auth`
- `/api/nodes`
- `/api/images`
- `/api/v2/capsules`, `/api/v2/instances`, and `/api/v2/operations`
- `/api/users`

API failures should be presented with actionable messages and should never silently replace persisted state with mock data.

The Capsule client is isolated in `lib/capsule-api.ts`. It owns transport details,
safe error normalization, correlation IDs, exact revision preconditions, resource
catalogues, assignments, and image versions. Components consume the canonical
types in `lib/capsule-types.ts`; topology remains server-backed rather than being
treated as browser-local state.

Draft edits are serialized and debounced. The editor shows saving, saved, failed,
and conflict states, retains local work after a failed request, and lets the user
retry or reload the server revision. Publishing remains an explicit action.

## Frontend development rules

- Keep server and client component boundaries explicit.
- Keep shared request and response shapes in `lib/types.ts`.
- Avoid duplicating node or image state across unrelated components.
- Prefer reusable hooks for polling, WebSocket state, and mutations.
- Preserve keyboard access and visible focus behavior for canvas and modal actions.
- Treat destructive operations such as wipe and delete as confirmed actions.
- Do not hard-code service URLs in components.

## Validation before a pull request

```bash
npm run build
npm test
```

The current package also contains a legacy `next lint` script. Until lint configuration is migrated to a direct ESLint command, the production build is the required frontend CI gate.

## Near-term frontend improvements

- Managed-image operation progress and failure recovery
- Lab spec import/export from the topology canvas
- VM snapshot and clone controls
- Bulk node start, stop, and reset operations
- Search and filtering for large labs
- Event-driven status updates instead of fixed polling
- Host-level admission checks and organization quota visibility

See the root [README](../README.md) and [architecture guide](../docs/ARCHITECTURE.md).
