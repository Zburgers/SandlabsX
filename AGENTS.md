# SandBoxLabs - Project Context & Agent Briefing

## 🎯 Project Overview

**SandBoxLabs** is a production-ready network lab virtualization platform that enables users to:
- Create and manage virtual machines through a web browser
- Access VM consoles via Guacamole (browser-based VNC)
- Design network topologies using a visual canvas editor
- Manage labs with role-based access control
- Track all actions via comprehensive audit logging

**Status:** Production-ready with full authentication, authorization, and advanced features  
**Branch:** `feature/prd-v1.1`  
**Last Commit:** `c4a2cc9` - Auth UI and RBAC fully functional  
**Codebase:** ~6,043 LOC (backend + frontend)

---

## 🏗️ Architecture & Technology Stack

### Frontend (Port 3000)
- **Framework:** Next.js 15 + React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Visualization:** React Flow, Dagre
- **Terminal:** xterm.js
- **Code:** ~2,078 LOC

### Backend (Port 3001)
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 16
- **Logging:** Pino (structured)
- **Auth:** JWT (24-hour tokens)
- **Code:** ~3,965 LOC

### Infrastructure
- **Database:** PostgreSQL 16 (Port 5432)
  - Guacamole schema + custom lab/node/user tables
  - Audit logging table
- **Console Server:** Guacamole 1.5.4 (Port 8081)
  - Web-based VNC console access
  - Auto-registration via PostgreSQL
- **VNC Proxy:** Guacd (Port 4822)
  - Translates VNC to web protocol
- **Virtualization:** QEMU/KVM
  - Copy-on-write overlays (qcow2)
  - Dynamic VNC port allocation (5900+)
  - KVM acceleration or TCG fallback

### Orchestration
- **Deployment:** Docker Compose
- **Container Images:** Custom-built frontend & backend
- **Volumes:** Database persistence, overlay storage

---

## 📁 Project Structure

```
sandboxlabs/
├── frontend/                    Next.js 15 + React 19 UI (2,078 LOC)
│   ├── app/
│   │   ├── layout.tsx          Root layout (32 LOC)
│   │   ├── page.tsx            Main dashboard (368 LOC)
│   │   └── redirect.tsx        Auth redirect (38 LOC)
│   ├── components/
│   │   ├── AccountDropdown.tsx  User menu (100 LOC)
│   │   ├── NodeCard.tsx         VM display card (294 LOC)
│   │   ├── CreateNodeModal.tsx  Node creation UI (417 LOC)
│   │   ├── GuacamoleViewer.tsx  Console viewer (732 LOC)
│   │   ├── Button.tsx           Reusable button (67 LOC)
│   │   ├── StatusBadge.tsx      Status indicator (54 LOC)
│   │   └── canvas/              Network topology editor (1,172 LOC)
│   │       ├── CanvasEditor.tsx (423 LOC)
│   │       ├── CanvasToolbar.tsx (112 LOC)
│   │       ├── NetworkNode.tsx (102 LOC)
│   │       ├── PropertiesPanel.tsx (250 LOC)
│   │       ├── ContextMenu.tsx (108 LOC)
│   │       ├── AddNodeModal.tsx (177 LOC)
│   │       └── index.ts
│   ├── hooks/                   Custom hooks
│   │   └── useAuth.ts          Authentication hook
│   ├── lib/                     Utilities
│   │   └── api.ts              Backend API client
│   └── tailwind.config.js      Styling config
│
├── backend/                     Node.js Express API (3,965 LOC)
│   ├── server.js               Main API server (1,271 LOC)
│   ├── modules/                Core business logic
│   │   ├── qemuManager.js      VM lifecycle (1,051 LOC)
│   │   ├── labManager.js       Lab CRUD & topology (819 LOC)
│   │   ├── guacamoleClient.js  Console integration (225 LOC)
│   │   ├── nodeManagerPostgres.js Database layer (241 LOC)
│   │   ├── nodeManager.js      State management (152 LOC)
│   │   └── auditLogger.js      Audit trail logging (182 LOC)
│   ├── middleware/
│   │   ├── auth.js             JWT validation
│   │   └── errorHandler.js     Global error handling
│   ├── controllers/
│   │   └── nodeController.js   Route handlers
│   ├── schema/
│   │   └── nodes-schema.sql    Database schema
│   ├── swagger.js              OpenAPI/Swagger docs
│   ├── logger.js               Pino logger setup
│   ├── .env                    Configuration
│   └── package.json            Dependencies
│
├── docker-compose.yml          Infrastructure definition
├── initdb-schema.sql           Database initialization
├── images/                     VM base images
│   └── base.qcow2             Base OS disk
├── overlays/                   VM overlay disks (auto-created)
├── vms/                        VM metadata
└── .git/                       Version control
```

---

## 🔑 Key API Endpoints (20+)

### Lab Management
```
POST   /api/labs              Create lab
GET    /api/labs              List labs (RBAC filtered)
GET    /api/labs/:id          Get lab details
PUT    /api/labs/:id          Update lab
DELETE /api/labs/:id          Delete lab
POST   /api/labs/:id/export   Export lab config
POST   /api/labs/import       Import lab config
```

### Node Operations (VMs)
```
POST   /api/nodes             Create node
GET    /api/nodes             List all nodes
GET    /api/nodes/:id         Get node details
POST   /api/nodes/:id/run     Start VM
POST   /api/nodes/:id/stop    Stop VM
POST   /api/nodes/:id/reboot  Reboot VM
DELETE /api/nodes/:id         Delete node
POST   /api/nodes/:id/wipe    Wipe node data
GET    /api/nodes/:id/console Get console URL
```

### Image Management
```
GET    /api/images            List images
POST   /api/images/upload     Upload custom image
DELETE /api/images/:id        Remove image
```

### Authentication
```
POST   /auth/register         Create account
POST   /auth/login            Login user
POST   /auth/refresh          Refresh JWT
POST   /auth/logout           Logout
GET    /auth/me               Get current user
```

### System
```
GET    /api/health            Health check
GET    /api/system/stats      Resource usage
GET    /api/audit-log         View audit trail (admin)
```

---

## 🔐 Authentication & Authorization

### Authentication Flow
1. **Register** → `POST /auth/register` (email/password)
2. **Login** → `POST /auth/login` → Receive JWT token
3. **Storage** → Token in HTTP-only cookie (secure)
4. **Requests** → JWT in Authorization header
5. **Validation** → Backend validates token + checks role
6. **Access** → RBAC determines permissions
7. **Refresh** → `POST /auth/refresh` before expiry

### RBAC - Role-Based Access Control
| Role | Permissions |
|------|-----------|
| **Admin** | Full system access, manage users, view audit logs |
| **Instructor** | Create/manage labs, view all nodes, manage student access |
| **Student** | Access assigned labs, create/manage own nodes |
| **Viewer** | Read-only access to labs and nodes |

---

## 📊 Database Schema

### Users & Authentication
```sql
users (id, email, password_hash, role, created_at, updated_at)
auth_tokens (id, user_id, token, expires_at, created_at)
```

### Labs & Network
```sql
labs (id, name, description, owner_id, topology, created_at, updated_at)
nodes (id, lab_id, name, type, status, vnc_port, created_at, updated_at)
connections (id, lab_id, node1_id, node2_id, connection_type, created_at)
```

### Images & Virtualization
```sql
images (id, name, type, path, size_mb, checksum, created_at)
node_images (id, node_id, image_id, deployed_at)
```

### Audit & Logging
```sql
audit_log (id, user_id, action, resource_type, resource_id, timestamp)
guacamole_connection (id, connection_name, hostname, port, protocol)
```

---

## 🚀 How It Works - Complete Flow

### Example: Create and Connect to VM

```
1. USER CLICKS "CREATE NODE" (Frontend)
   └─ Form: image, resources (CPU, RAM), network config

2. FRONTEND → BACKEND API
   POST /api/nodes
   {
     "name": "lab-node-1",
     "image": "fedora-38",
     "cpu": 2,
     "ram": 2048,
     "labId": "lab-123"
   }

3. BACKEND PROCESSING (Express + Modules)
   a) labManager.js: Validate lab & permissions (RBAC)
   b) qemuManager.js:
      - Create overlay: qemu-img create -f qcow2 -b base.qcow2 node_uuid.qcow2
      - Allocate VNC port (5900, 5901, etc.)
   c) nodeManagerPostgres.js: INSERT into database
   d) Return: { id, status: "stopped", vncPort: 5900 }

4. FRONTEND DISPLAYS NODE
   └─ Status: Stopped, Show "Run" button

5. USER CLICKS "RUN"
   POST /api/nodes/:id/run

6. BACKEND SPAWNS QEMU PROCESS
   qemu-system-x86_64 \
     -enable-kvm \
     -m 2048 -smp 2 \
     -hda overlays/node_uuid.qcow2 \
     -vnc 0.0.0.0:0 \
     -netdev user,id=net0 \
     -device e1000,netdev=net0

7. BACKEND REGISTERS WITH GUACAMOLE
   guacamoleClient.js:
   INSERT INTO guacamole_connection
   (connection_name, protocol, hostname, port)
   VALUES ('node-uuid', 'vnc', 'localhost', 5900)

8. BACKEND GENERATES GUACAMOLE URL
   Return: {
     status: "running",
     guacamoleUrl: "http://localhost:8081/guacamole/#/client/[token]"
   }

9. FRONTEND UPDATES UI
   └─ Status: Running, Show "Console" button

10. USER CLICKS "CONSOLE"
    └─ GuacamoleViewer opens iframe with URL

11. GUACAMOLE INTEGRATION
    a) User connects to Guacamole URL
    b) Guacamole connects to VNC (localhost:5900)
    c) Guacd translates VNC ↔ Web protocol
    d) User sees live VM desktop in browser

12. SHUTDOWN
    User clicks "Stop"
    → Backend: pkill/SIGTERM to qemu
    → VM gracefully shuts down
    → Status: Stopped

13. CLEANUP
    User clicks "Wipe"
    → Backend: rm overlays/node_uuid.qcow2
    → Database record deleted
```

---

## 🔧 Backend Modules Deep Dive

### `server.js` (1,271 LOC)
Main Express application server:
- Route registration for all 20+ endpoints
- JWT middleware setup
- Error handling & validation
- CORS configuration
- Swagger/OpenAPI documentation
- Health checks

### `modules/qemuManager.js` (1,051 LOC)
QEMU VM lifecycle management:
- `createOverlay()` - Create copy-on-write disk
- `startVM()` - Spawn QEMU process with VNC
- `stopVM()` - Graceful QEMU shutdown
- `monitorVM()` - Track process status
- `allocateVNCPort()` - Dynamic port assignment
- `configureResources()` - CPU/RAM settings
- Process monitoring and cleanup

### `modules/labManager.js` (819 LOC)
Lab CRUD operations and topology management:
- `createLab()` - Create new lab with topology
- `updateTopology()` - Modify network connections
- `exportLab()` - Export as JSON config
- `importLab()` - Import and instantiate
- `validateTopology()` - Check connections
- `getLabStats()` - Resource usage reporting

### `modules/guacamoleClient.js` (225 LOC)
Guacamole connection management:
- `registerConnection()` - Add VNC to Guacamole DB
- `generateConnectionToken()` - Create auth token
- `getConnectionURL()` - Generate client link
- `deleteConnection()` - Cleanup on removal
- Direct PostgreSQL connection registration

### `modules/nodeManagerPostgres.js` (241 LOC)
Database operations for node persistence:
- `saveNode()` - Insert/update node record
- `getNode()` - Retrieve node details
- `deleteNode()` - Remove node from DB
- `listNodes()` - Query all nodes (with filtering)
- `updateStatus()` - Change node state

### `modules/auditLogger.js` (182 LOC)
Audit trail logging:
- Tracks all user actions
- Logs: login/logout, node operations, lab modifications
- Logs: user role changes, data exports, access violations
- Used for compliance and debugging

---

## 🎨 Frontend Components

### `app/page.tsx` (368 LOC)
Main dashboard view:
- Authentication check
- Real-time node list with status polling (5s)
- Tab-based layout: Nodes, Canvas, Labs
- Error boundary handling
- Loading states

### `components/GuacamoleViewer.tsx` (732 LOC)
Embedded VNC console:
- Iframe-based Guacamole integration
- Keyboard/mouse passthrough
- Full-screen toggle
- Ctrl+Alt+Del support
- Connection state monitoring
- Auto-reconnect on disconnect

### `components/canvas/CanvasEditor.tsx` (423 LOC)
Network topology visualization:
- React Flow nodes and edges
- Drag-and-drop node placement
- Real-time status sync
- Context menu operations
- Dagre layout algorithms
- Topology export

### `components/CreateNodeModal.tsx` (417 LOC)
Node creation dialog:
- Image selection (Fedora, Ubuntu, custom)
- Resource configuration (RAM, CPU)
- Network settings
- Advanced options form

### `components/NodeCard.tsx` (294 LOC)
VM node display card:
- Status indicator (Running/Stopped/Error)
- Quick actions (Run, Stop, Delete)
- Resource display
- Console access button

---

## ⚡ Performance Characteristics

- **Create node:** ~50ms (overlay creation)
- **Start VM:** ~3-5s (includes boot)
- **Stop VM:** ~1-2s (graceful shutdown)
- **Delete node:** ~20ms (cleanup)
- **Console connect:** ~200ms (VNC negotiation)
- **Max concurrent VMs:** ~10-15 (depends on system RAM)
- **Overlay overhead:** ~10MB per VM
- **Base image:** 290MB (shared across all nodes)

---

## 🔒 Security Features

✅ **JWT Authentication** - Token-based, 24-hour validity  
✅ **RBAC** - Role-based access control at API level  
✅ **CORS** - Restricted to frontend origin  
✅ **Input Validation** - All user inputs sanitized  
✅ **Error Handling** - Errors don't leak sensitive info  
✅ **Rate Limiting** - Brute-force protection  
✅ **Audit Logging** - All actions tracked  
✅ **HTTP-only Cookies** - JWT stored securely  
✅ **SQL Injection Prevention** - Parameterized queries  
✅ **XSS Prevention** - React auto-escapes  

---

## 📋 Common Development Tasks

### Add New API Endpoint
1. Add route in `backend/server.js`
2. Add JSDoc comment with @swagger tags
3. Implement business logic (use existing modules)
4. Test with curl/Postman
5. Update frontend to call endpoint

### Add New Frontend Component
1. Create component in `frontend/components/`
2. Import and use in `app/page.tsx`
3. Style with Tailwind CSS
4. Call backend API via `lib/api.ts`

### Debug Backend
```bash
# View logs
npm start  # or docker-compose logs -f backend

# Check health
curl http://localhost:3001/api/health

# View Swagger docs
curl http://localhost:3001/api/docs
```

### Debug Frontend
```bash
# Browser DevTools (F12)
# Next.js terminal shows build errors
npm run dev
```

---

## 🚀 Quick Start

```bash
cd /home/naki/Desktop/itsthatnewshit/sandboxlabs

# Terminal 1: Infrastructure
docker-compose up -d

# Terminal 2: Backend
cd backend && npm install && npm start

# Terminal 3: Frontend
cd frontend && npm install && npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Docs: http://localhost:3001/api/docs
- Guacamole: http://localhost:8081
- Database: localhost:5432

---

## 📂 Important Files to Know

**Backend:**
- `backend/server.js` - Main API server
- `backend/modules/qemuManager.js` - VM lifecycle
- `backend/modules/labManager.js` - Lab management
- `backend/.env` - Configuration

**Frontend:**
- `frontend/app/page.tsx` - Main dashboard
- `frontend/components/` - UI components
- `frontend/lib/api.ts` - API client

**Infrastructure:**
- `docker-compose.yml` - Container setup
- `backend/schema/nodes-schema.sql` - Database schema
- `initdb-schema.sql` - Guacamole schema

---

## 🧪 Testing Approach

**Backend API Testing:**
- Import `backend/modules/postman.json` into Postman
- Requires valid JWT token from login endpoint
- Test all 20+ endpoints

**Database Verification:**
```bash
psql -U guacamole_user -d guacamole_db -h localhost
SELECT * FROM nodes;
SELECT * FROM labs;
SELECT * FROM audit_log ORDER BY timestamp DESC;
```

---

## ❌ Common Issues & Solutions

**QEMU won't start:**
```bash
kvm-ok  # Check KVM available
# Falls back to TCG if not available (slower)
```

**Guacamole connection fails:**
```bash
docker-compose restart guacamole guacd
# Verify Guacamole is running
docker-compose logs guacamole
```

**Backend port in use:**
```bash
lsof -i :3001
kill -9 <PID>
# Or change PORT in .env
```

---

## 📌 Current Status

✅ **Complete:**
- Full-stack application (frontend + backend)
- Authentication & Authorization
- VM management lifecycle
- Console access (Guacamole)
- Network topology editor
- Lab management
- Audit logging
- API documentation

⏳ **In Progress:**
- E2E integration testing
- Performance optimization
- Load testing

---

# AGENTS

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>anti-reversing-techniques</name>
<description>Understand anti-reversing, obfuscation, and protection techniques encountered during software analysis. Use when analyzing protected binaries, bypassing anti-debugging for authorized analysis, or understanding software protection mechanisms.</description>
<location>global</location>
</skill>

<skill>
<name>api-design-principles</name>
<description>Master REST and GraphQL API design principles to build intuitive, scalable, and maintainable APIs that delight developers. Use when designing new APIs, reviewing API specifications, or establishing API design standards.</description>
<location>global</location>
</skill>

<skill>
<name>architecture-decision-records</name>
<description>Write and maintain Architecture Decision Records (ADRs) following best practices for technical decision documentation. Use when documenting significant technical decisions, reviewing past architectural choices, or establishing decision processes.</description>
<location>global</location>
</skill>

<skill>
<name>architecture-patterns</name>
<description>Implement proven backend architecture patterns including Clean Architecture, Hexagonal Architecture, and Domain-Driven Design. Use when architecting complex backend systems or refactoring existing applications for better maintainability.</description>
<location>global</location>
</skill>

<skill>
<name>backend</name>
<description></description>
<location>global</location>
</skill>

<skill>
<name>changelog-automation</name>
<description>Automate changelog generation from commits, PRs, and releases following Keep a Changelog format. Use when setting up release workflows, generating release notes, or standardizing commit conventions.</description>
<location>global</location>
</skill>

<skill>
<name>code-review-excellence</name>
<description>Master effective code review practices to provide constructive feedback, catch bugs early, and foster knowledge sharing while maintaining team morale. Use when reviewing pull requests, establishing review standards, or mentoring developers.</description>
<location>global</location>
</skill>

<skill>
<name>data-storytelling</name>
<description>Transform data into compelling narratives using visualization, context, and persuasive structure. Use when presenting analytics to stakeholders, creating data reports, or building executive presentations.</description>
<location>global</location>
</skill>

<skill>
<name>debugging-strategies</name>
<description>Master systematic debugging techniques, profiling tools, and root cause analysis to efficiently track down bugs across any codebase or technology stack. Use when investigating bugs, performance issues, or unexpected behavior.</description>
<location>global</location>
</skill>

<skill>
<name>design-system-patterns</name>
<description>Build scalable design systems with design tokens, theming infrastructure, and component architecture patterns. Use when creating design tokens, implementing theme switching, building component libraries, or establishing design system foundations.</description>
<location>global</location>
</skill>

<skill>
<name>e2e-testing-patterns</name>
<description>Master end-to-end testing with Playwright and Cypress to build reliable test suites that catch bugs, improve confidence, and enable fast deployment. Use when implementing E2E tests, debugging flaky tests, or establishing testing standards.</description>
<location>global</location>
</skill>

<skill>
<name>error-handling-patterns</name>
<description>Master error handling patterns across languages including exceptions, Result types, error propagation, and graceful degradation to build resilient applications. Use when implementing error handling, designing APIs, or improving application reliability.</description>
<location>global</location>
</skill>

<skill>
<name>find-skills</name>
<description>Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.</description>
<location>global</location>
</skill>

<skill>
<name>github-actions-templates</name>
<description>Create production-ready GitHub Actions workflows for automated testing, building, and deploying applications. Use when setting up CI/CD with GitHub Actions, automating development workflows, or creating reusable workflow templates.</description>
<location>global</location>
</skill>

<skill>
<name>gitlab-ci-patterns</name>
<description>Build GitLab CI/CD pipelines with multi-stage workflows, caching, and distributed runners for scalable automation. Use when implementing GitLab CI/CD, optimizing pipeline performance, or setting up automated testing and deployment.</description>
<location>global</location>
</skill>

<skill>
<name>gitops-workflow</name>
<description>Implement GitOps workflows with ArgoCD and Flux for automated, declarative Kubernetes deployments with continuous reconciliation. Use when implementing GitOps practices, automating Kubernetes deployments, or setting up declarative infrastructure management.</description>
<location>global</location>
</skill>

<skill>
<name>interaction-design</name>
<description>Design and implement microinteractions, motion design, transitions, and user feedback patterns. Use when adding polish to UI interactions, implementing loading states, or creating delightful user experiences.</description>
<location>global</location>
</skill>

<skill>
<name>javascript-testing-patterns</name>
<description>Implement comprehensive testing strategies using Jest, Vitest, and Testing Library for unit tests, integration tests, and end-to-end testing with mocking, fixtures, and test-driven development. Use when writing JavaScript/TypeScript tests, setting up test infrastructure, or implementing TDD/BDD workflows.</description>
<location>global</location>
</skill>

<skill>
<name>llm-evaluation</name>
<description>Implement comprehensive evaluation strategies for LLM applications using automated metrics, human feedback, and benchmarking. Use when testing LLM performance, measuring AI application quality, or establishing evaluation frameworks.</description>
<location>global</location>
</skill>

<skill>
<name>memory-forensics</name>
<description>Master memory forensics techniques including memory acquisition, process analysis, and artifact extraction using Volatility and related tools. Use when analyzing memory dumps, investigating incidents, or performing malware analysis from RAM captures.</description>
<location>global</location>
</skill>

<skill>
<name>memory-safety-patterns</name>
<description>Implement memory-safe programming with RAII, ownership, smart pointers, and resource management across Rust, C++, and C. Use when writing safe systems code, managing resources, or preventing memory bugs.</description>
<location>global</location>
</skill>

<skill>
<name>microservices-patterns</name>
<description>Design microservices architectures with service boundaries, event-driven communication, and resilience patterns. Use when building distributed systems, decomposing monoliths, or implementing microservices.</description>
<location>global</location>
</skill>

<skill>
<name>modern-javascript-patterns</name>
<description>Master ES6+ features including async/await, destructuring, spread operators, arrow functions, promises, modules, iterators, generators, and functional programming patterns for writing clean, efficient JavaScript code. Use when refactoring legacy code, implementing modern patterns, or optimizing JavaScript applications.</description>
<location>global</location>
</skill>

<skill>
<name>nodejs-backend-patterns</name>
<description>Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handling, authentication, database integration, and API design best practices. Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures.</description>
<location>global</location>
</skill>

<skill>
<name>postgresql</name>
<description>Design a PostgreSQL-specific schema. Covers best-practices, data types, indexing, constraints, performance patterns, and advanced features</description>
<location>global</location>
</skill>

<skill>
<name>react-native-architecture</name>
<description>Build production React Native apps with Expo, navigation, native modules, offline sync, and cross-platform patterns. Use when developing mobile apps, implementing native integrations, or architecting React Native projects.</description>
<location>global</location>
</skill>

<skill>
<name>react-native-design</name>
<description>Master React Native styling, navigation, and Reanimated animations for cross-platform mobile development. Use when building React Native apps, implementing navigation patterns, or creating performant animations.</description>
<location>global</location>
</skill>

<skill>
<name>react-state-management</name>
<description>Master modern React state management with Redux Toolkit, Zustand, Jotai, and React Query. Use when setting up global state, managing server state, or choosing between state management solutions.</description>
<location>global</location>
</skill>

<skill>
<name>responsive-design</name>
<description>Implement modern responsive layouts using container queries, fluid typography, CSS Grid, and mobile-first breakpoint strategies. Use when building adaptive interfaces, implementing fluid layouts, or creating component-level responsive behavior.</description>
<location>global</location>
</skill>

<skill>
<name>security-requirement-extraction</name>
<description>Derive security requirements from threat models and business context. Use when translating threats into actionable requirements, creating security user stories, or building security test cases.</description>
<location>global</location>
</skill>

<skill>
<name>typescript-advanced-types</name>
<description>Master TypeScript's advanced type system including generics, conditional types, mapped types, template literals, and utility types for building type-safe applications. Use when implementing complex type logic, creating reusable type utilities, or ensuring compile-time type safety in TypeScript projects.</description>
<location>global</location>
</skill>

<skill>
<name>visual-design-foundations</name>
<description>Apply typography, color theory, spacing systems, and iconography principles to create cohesive visual designs. Use when establishing design tokens, building style guides, or improving visual hierarchy and consistency.</description>
<location>global</location>
</skill>

<skill>
<name>web-component-design</name>
<description>Master React, Vue, and Svelte component patterns including CSS-in-JS, composition strategies, and reusable component architecture. Use when building UI component libraries, designing component APIs, or implementing frontend design systems.</description>
<location>global</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
