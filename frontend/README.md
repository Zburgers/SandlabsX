# SandLabX frontend

The SandLabX web application is built with Next.js 15, React 19, TypeScript, Tailwind CSS, React Flow, and xterm.js. It provides node lifecycle controls, a topology canvas, image selection, authentication workflows, and browser console access.

## Development

```bash
cd frontend
npm install --no-audit --no-fund
npm run dev
```

The development server listens on `http://localhost:3000`.

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

- **Dashboard:** node status, resources, and lifecycle actions
- **Topology canvas:** visual nodes and network links
- **Image selection:** built-in and custom image choices
- **Serial console:** xterm.js-based terminal access
- **Graphical console:** Guacamole-backed browser sessions
- **Authentication:** login and protected application state

## API integration

The API client under `lib/` should remain the only place that knows backend URL construction and transport details. UI components should consume typed functions rather than construct `fetch` calls directly.

Backend endpoint groups currently include:

- `/api/auth`
- `/api/nodes`
- `/api/images`
- `/api/labs`
- `/api/users`

API failures should be presented with actionable messages and should never silently replace persisted state with mock data.

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
```

The current package also contains a legacy `next lint` script. Until lint configuration is migrated to a direct ESLint command, the production build is the required frontend CI gate.

## Near-term frontend improvements

- Managed-image operation progress and failure recovery
- Lab spec import/export from the topology canvas
- VM snapshot and clone controls
- Bulk node start, stop, and reset operations
- Search and filtering for large labs
- Event-driven status updates instead of fixed polling
- Resource quota and capacity visibility

See the root [README](../README.md) and [architecture guide](../docs/ARCHITECTURE.md).
