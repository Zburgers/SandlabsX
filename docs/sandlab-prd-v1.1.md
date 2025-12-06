# SandlabX: Technical Product Requirements Document (PRD)
**Version**: 1.0 | **Status**: Active Development | **Last Updated**: December 2025

---

## 1. Executive Summary (Synthesized)

### The Problem
Network education and enterprise lab environments face critical gaps:
- **EVE-NG & netlab** require licensing or steep learning curves (YAML + networking expertise)
- **Open-source alternatives** lack visual, web-based interfaces
- **Educational platforms** need affordable, customizable, real-time network simulation
- **Startups & SMBs** cannot justify enterprise licensing for training environments

### The Solution
**SandlabX**: A fully open-source, web-based network lab platform that combines:
- **Visual canvas editor** (drag-and-drop topology design, real-time connection editing)
- **Multi-device support** (Linux, Cisco IOS via serial, custom QCOW2 images)
- **Dual-access console** (VNC for graphical, serial for CLI/router access)
- **Infrastructure-as-Code** ready (Docker-based, YAML/JSON export for automation)
- **Enterprise-grade security** (JWT auth, RBAC, multi-tenant capable)
- **Scaling architecture** (single-host MVP → Kubernetes-ready design)

### Core Mechanics (5 Pillars)

**1. Node Lifecycle Management**
- Create VM instances from base images (copy-on-write overlays, ~10MB storage per VM)
- Start/stop/wipe VMs with persistent state tracking
- Support multiple OS types (Ubuntu, Debian, Cisco IOS, custom images)

**2. Dual Console Access**
- **VNC**: Graphical desktop access via Apache Guacamole + WebSocket proxy
- **Serial**: TTY console for routers, low-level device access via xterm.js
- Real-time streaming with connection pooling

**3. Network Topology Canvas**
- Drag-and-drop node placement in free-form canvas (planned Phase 2)
- Create/delete connections (TAP interfaces) between nodes
- Visual topology persistence (JSON-based lab snapshots)

**4. Custom Image Management**
- Upload QCOW2 images with format validation
- Auto-conversion of raw/img formats to QCOW2
- Per-lab image selection + overlay creation

**5. Lab Orchestration & Persistence**
- Multi-node lab creation with automatic interface bridging
- State persistence (node metadata in PostgreSQL)
- Export/import labs as JSON templates
- Wireshark integration-ready (TAP capture points)

---

## 2. High-Level System Architecture

### Tech Stack Strategy

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Containerization** | Docker + Docker Compose | Reproducible, isolated services, native to Linux (target deployment environment) |
| **Backend Runtime** | Node.js v18+ + Express | Non-blocking I/O for WebSocket streaming, native child_process for QEMU spawning |
| **Database** | PostgreSQL + Guacamole DB | Transactional for node metadata, ACID compliance for lab state, proven enterprise stability |
| **Virtualization** | QEMU/KVM + qemu-img | Lightweight, hardware-accelerated (KVM), no hypervisor overhead, native Linux support |
| **Console Bridge** | Apache Guacamole + ws library | Industry-standard VNC→WS proxy, proven uptime, supports future SSH/RDP scaling |
| **Frontend** | Next.js 14+ + React 18+ + xterm.js | Server-side rendering, SSG for performance, React ecosystem rich for canvas UI (ReactFlow) |
| **Canvas Editor** | ReactFlow (planned) | MIT-licensed, physics-based layout, extensive node/edge API, no vendor lock-in |
| **Type Safety** | TypeScript (Phase 1) | Gradual migration via JSDoc + tsc --noCheck, enables CI/CD type validation |
| **Logging** | Pino (planned) | Structured JSON logging, 10x faster than Winston, built-in cloud sink support |

### Data Flow Architecture

```
USER ACTION (Frontend)
    ↓
Browser Event (e.g., Create Node button click)
    ↓
Next.js API Client (frontend/lib/api.ts)
    │ - Adds JWT token to Authorization header
    │ - Validates input (name, osType, resources)
    ↓
Express Backend (backend/server.js)
    │ - Auth middleware verifies JWT
    │ - Rate limiting applied (future)
    │ - Validates request body against schema
    ↓
NodeManager.createNode()
    │ - Generates UUID for node
    │ - Stores metadata in PostgreSQL
    │ - Returns node object with overlay path
    ↓
QemuManager.createOverlay()
    │ - Executes: qemu-img create -f qcow2 -b <base> <overlay>
    │ - Creates backing chain: base → overlay
    │ - Stores overlay path in state
    ↓
HTTP Response (201 Created)
    │ - Sends node object to frontend
    │ - Includes nodeId, status: 'created', overlayPath
    ↓
Frontend Updates UI
    │ - Adds node card to dashboard
    │ - Caches node data in React state
    │ - Listens for WebSocket updates (future)
    ↓
UI Renders Node Card
    └─ Shows node name, OS type, "Start" button
```

**When Starting a Node:**

```
POST /api/nodes/:id/run
    ↓
QemuManager.startVM(node)
    │ - Allocates VNC_PORT (e.g., 5900 + node_index)
    │ - Spawns child_process: qemu-system-x86_64 -enable-kvm -vnc 0.0.0.0:5900 -serial stdio ...
    │ - Captures STDOUT (serial console) → WebSocket stream
    ↓
GuacamoleClient.registerConnection(node, vncPort)
    │ - Inserts PostgreSQL connection record (guacamole schema)
    │ - Guacamole scans DB, auto-discovers VNC connection
    ↓
NodeManager.updateNode(id, { status: 'running', vncPort, guacUrl })
    │ - Updates PostgreSQL with running state + console URLs
    ↓
Frontend Receives Response
    │ - Displays "Running" badge
    │ - Shows VNC embed link (guacUrl)
    │ - Shows serial console WebSocket endpoint
    ↓
User Clicks "Console"
    └─ Browser renders Guacamole iframe or xterm.js terminal
```

---

## 3. Database Schema & Data Modeling

### Core Entities (PostgreSQL)

#### **Table: nodes** (SandlabX Custom)
Node metadata and lifecycle tracking.

```sql
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    osType VARCHAR(50) NOT NULL, -- 'ubuntu', 'debian', 'cisco-ios', 'custom'
    status VARCHAR(50) DEFAULT 'created', -- created, running, stopped, error
    baseImage VARCHAR(255) NOT NULL, -- e.g., 'ubuntu-24-lts.qcow2'
    overlayPath VARCHAR(512) NOT NULL, -- /overlays/node-uuid.qcow2
    
    -- Runtime State
    vncPort INTEGER, -- e.g., 5900, NULL if not running
    serialPort VARCHAR(100), -- e.g., '/tmp/serial-uuid', NULL if not running
    guacConnectionId INTEGER, -- FK to guacamole_connection.connection_id
    guacUrl TEXT, -- URL to Guacamole console
    pid INTEGER, -- QEMU process PID, NULL if not running
    
    -- Resource Allocation
    vcpus INTEGER DEFAULT 1,
    memoryMb INTEGER DEFAULT 1024,
    diskGb INTEGER DEFAULT 10,
    
    -- Timestamps
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    startedAt TIMESTAMP,
    stoppedAt TIMESTAMP,
    wipedAt TIMESTAMP,
    deletedAt TIMESTAMP,
    
    -- Ownership & Lab Association (future multi-tenant)
    userId UUID, -- FK to users table (planned)
    labId UUID,  -- FK to labs table (planned)
    
    INDEX idx_status (status),
    INDEX idx_userId (userId),
    INDEX idx_labId (labId)
);
```

#### **Table: connections** (SandlabX Custom)
Network connections (TAP interfaces, VLANs) between nodes.

```sql
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labId UUID NOT NULL, -- FK to labs table
    sourceNodeId UUID NOT NULL, -- FK to nodes.id
    targetNodeId UUID NOT NULL, -- FK to nodes.id
    
    -- Connection Type
    type VARCHAR(50) DEFAULT 'tap', -- 'tap', 'vlan', 'bridge'
    sourceInterface VARCHAR(50), -- 'eth0', 'eth1', etc.
    targetInterface VARCHAR(50),
    
    -- Topology Metadata
    bandwidth INTEGER, -- Mbps (for future QoS simulation)
    latency INTEGER, -- ms (for future network simulation)
    
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deletedAt TIMESTAMP,
    
    INDEX idx_labId (labId),
    INDEX idx_sourceNodeId (sourceNodeId),
    INDEX idx_targetNodeId (targetNodeId)
);
```

#### **Table: labs** (SandlabX Custom, Planned)
Lab templates and snapshots.

```sql
CREATE TABLE labs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    userId UUID NOT NULL, -- FK to users table
    
    -- Lab Topology State
    topologyJson JSONB NOT NULL, -- Serialized canvas + nodes + connections
    templateName VARCHAR(255), -- e.g., 'BGP_SETUP', 'OSPF_LAB'
    
    -- Sharing & Collaboration
    isPublic BOOLEAN DEFAULT FALSE,
    isTemplate BOOLEAN DEFAULT FALSE, -- Shareable template
    
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP,
    deletedAt TIMESTAMP,
    
    INDEX idx_userId (userId),
    INDEX idx_isPublic (isPublic),
    INDEX idx_isTemplate (isTemplate)
);
```

#### **Table: images** (SandlabX Custom, Planned)
Custom image registry with metadata.

```sql
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    path VARCHAR(512) NOT NULL, -- /images/ubuntu-24-lts.qcow2
    
    -- Metadata
    format VARCHAR(20) DEFAULT 'qcow2', -- qcow2, raw, vmdk, etc.
    sizeGb DECIMAL(10, 2),
    osType VARCHAR(50), -- ubuntu, debian, cisco, custom
    
    -- Validation
    isValid BOOLEAN DEFAULT TRUE,
    lastValidatedAt TIMESTAMP,
    validationErrors TEXT,
    
    -- Ownership & Sharing
    userId UUID, -- NULL for system images
    isPublic BOOLEAN DEFAULT FALSE,
    
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deletedAt TIMESTAMP,
    
    INDEX idx_osType (osType),
    INDEX idx_isPublic (isPublic)
);
```

#### **Table: auditLog** (SandlabX Custom, Planned)
Security & compliance logging.

```sql
CREATE TABLE auditLog (
    id SERIAL PRIMARY KEY,
    userId UUID,
    action VARCHAR(100), -- 'CREATE_NODE', 'START_VM', 'DELETE_LAB', etc.
    resourceType VARCHAR(50), -- 'node', 'lab', 'image'
    resourceId UUID,
    
    -- Details
    details JSONB, -- Full action context
    ipAddress INET,
    userAgent TEXT,
    
    -- Outcome
    success BOOLEAN DEFAULT TRUE,
    errorMessage TEXT,
    
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_userId (userId),
    INDEX idx_action (action),
    INDEX idx_createdAt (createdAt)
);
```

#### **Guacamole DB Tables** (Apache Guacamole Schema)
Pre-existing tables used for VNC connection registry.

- `guacamole_connection`: Stores VNC connection definitions
- `guacamole_connection_parameter`: Parameters (hostname, port, username)
- `guacamole_user`: User credentials
- `guacamole_user_permission`: Access control

SandlabX leverages these for VNC registration without rebuilding auth.

### Relationships

```
┌─────────────────┐
│   users (*)     │ ──┐
└─────────────────┘   │
                      │
                      ├─→ ┌──────────────┐
                      │   │   labs       │
                      │   └──────────────┘
                      │        │
                      │        ├─→ ┌────────────────┐
                      │        │   │  nodes (*)     │
                      │        │   └────────────────┘
                      │        │        │
                      │        │        ├─→ ┌──────────────────┐
                      │        │        │   │  connections (*)  │
                      │        │        │   └──────────────────┘
                      │        │        │
                      │        │        └─→ ┌────────────────────────┐
                      │        │            │ guacamole_connection   │
                      │        │            └────────────────────────┘
                      │        │
                      │        └─→ ┌──────────────┐
                      │            │  images (*)  │
                      │            └──────────────┘
                      │
                      └─→ ┌──────────────────┐
                          │   auditLog (*)   │
                          └──────────────────┘
```

**Cardinality:**
- 1 User : Many Labs
- 1 User : Many Nodes (direct ownership)
- 1 Lab : Many Nodes (within lab context)
- 1 Node : Many Connections (as source or target)
- 1 Lab : Many Connections
- 1 Base Image : Many Nodes (via overlays, read-only reference)
- 1 User : Many AuditLog entries

---

## 4. Modular Feature Breakdown (Jira-Ready)

### **Feature Module 1: Node Lifecycle Management** ✅ (PHASE 0 - DONE)
**Status**: Implemented in codebase | Pending: Auth/validation enhancement

#### 1.1 Create Node
**User Story**: "As a network engineer, I want to create new VM instances from base images so that I can build a lab topology."

**Technical Implementation**:
- NodeManager receives `createNode(name, osType, resources)`
- Validates input: name must be unique, osType must be whitelisted, resources within limits
- Generates UUID for node
- Stores node metadata in PostgreSQL `nodes` table
- Calls QemuManager to create QCOW2 overlay (backing chain: base → overlay)
- Returns node object with status='created', overlay path, storage allocated

**API Endpoint**:
```
POST /api/nodes
{
  "name": "router-1",
  "osType": "cisco-ios",
  "resources": { "vcpus": 2, "memoryMb": 2048, "diskGb": 20 }
}
Response (201):
{
  "id": "uuid-abc123",
  "name": "router-1",
  "status": "created",
  "osType": "cisco-ios",
  "overlayPath": "/overlays/node-uuid-abc123.qcow2",
  "vcpus": 2,
  "memoryMb": 2048,
  "diskGb": 20,
  "createdAt": "2025-12-06T14:30:00Z"
}
```

**Frontend Components**:
- CreateNodeModal (form with OS type dropdown, resource sliders)
- NodeCard (displays node details, Start/Stop/Wipe/Delete buttons)
- ResourceAllocator (visual memory/CPU/disk sliders)

**Edge Cases**:
- Duplicate node names → Return 400 with error
- Invalid osType → Return 400, list valid types
- Insufficient storage for overlay → Return 507 Insufficient Storage
- Resource limits exceeded (user quota) → Return 429 Too Many Requests

**Jira Ticket Format**:
```
TITLE: Create Node - Backend Endpoint
DESCRIPTION: Implement POST /api/nodes for node creation with validation
ACCEPTANCE CRITERIA:
  - Unique name validation
  - OS type whitelisting (ubuntu, debian, cisco-ios, custom)
  - Resource limits enforced
  - QCOW2 overlay created on filesystem
  - PostgreSQL record inserted
IMPLEMENTATION: backend/modules/nodeManager.js::createNode()
TESTS: 3 (valid creation, duplicate name, invalid osType)
STORY POINTS: 3
```

#### 1.2 Start Node (Boot VM)
**User Story**: "As a lab user, I want to boot my created VM so that I can access the system and run configurations."

**Technical Implementation**:
- NodeManager retrieves node metadata from PostgreSQL
- Validates node is in 'created' or 'stopped' state
- QemuManager allocates VNC_PORT (5900 + node_index)
- Spawns QEMU process: `qemu-system-x86_64 -enable-kvm -drive file=<overlay>,if=virtio -m 2G -smp 2 -vnc 0.0.0.0:5900 -serial stdio`
- Captures serial STDOUT → WebSocket stream (for xterm.js)
- GuacamoleClient registers VNC connection in guacamole_connection table
- Updates node status to 'running' with vncPort, guacUrl, pid

**API Endpoint**:
```
POST /api/nodes/:id/run
Response (200):
{
  "id": "uuid-abc123",
  "status": "running",
  "vncPort": 5900,
  "guacConnectionId": 123,
  "guacUrl": "http://localhost:8080/guacamole/#/client/c/123",
  "serialPort": "/tmp/serial-uuid-abc123",
  "pid": 42123,
  "startedAt": "2025-12-06T14:35:00Z"
}
```

**Frontend Components**:
- NodeCard "Start" button → POST /api/nodes/:id/run
- Loading spinner during boot (~5 seconds)
- Once running, display VNC embed (Guacamole iframe) and Serial console (xterm.js)
- "Stop" button appears when running

**Edge Cases**:
- Node already running → Return 400 'Already running'
- Base image missing → Return 404 'Base image not found'
- QEMU binary not found → Return 500 with env error
- VNC port already in use → Return 503 'Port conflict'
- Overlay corrupted → Return 500 with validation error

#### 1.3 Stop Node (Shutdown VM)
**User Story**: "As a lab user, I want to stop a running VM so that I can free up resources or make state snapshots."

**Technical Implementation**:
- NodeManager retrieves running node from PostgreSQL
- QemuManager sends SIGTERM to QEMU process
- Waits for graceful shutdown (timeout: 10s, then SIGKILL)
- Unregisters from Guacamole (optional, can retain history)
- Updates node status to 'stopped' with cleared vncPort, guacConnectionId
- Preserves overlay (for future start)

**API Endpoint**:
```
POST /api/nodes/:id/stop
Response (200):
{
  "id": "uuid-abc123",
  "status": "stopped",
  "vncPort": null,
  "guacConnectionId": null,
  "stoppedAt": "2025-12-06T14:40:00Z"
}
```

**Frontend Components**:
- NodeCard "Stop" button (only visible when running)
- Confirmation dialog ("Stop VM? Progress will be lost.")
- Updated UI: badges change from "Running" to "Stopped"

**Edge Cases**:
- Node not running → Return 400
- QEMU process crashed → Clean up state, return 200 (idempotent)
- Unresponsive VM → Force kill after timeout, warn in response

#### 1.4 Wipe Node (Reset to Base State)
**User Story**: "As a lab user, I want to wipe a node to its original state so that I can rerun experiments without creating new VMs."

**Technical Implementation**:
- If node is running, stop it
- Delete overlay file
- Recreate overlay from base image: `qemu-img create -f qcow2 -b <base> <new_overlay>`
- Update node status to 'stopped'
- Clear runtime fields (vncPort, pid, guacConnectionId)
- Set wipedAt timestamp

**API Endpoint**:
```
POST /api/nodes/:id/wipe
Response (200):
{
  "id": "uuid-abc123",
  "status": "stopped",
  "message": "Node wiped successfully",
  "wipedAt": "2025-12-06T14:45:00Z"
}
```

**Frontend Components**:
- NodeCard "Wipe" button
- Warning dialog ("Wipe node? All changes will be lost.")

**Edge Cases**:
- Overlay deletion fails → Return 500, manual cleanup required
- Base image deleted → Return 404

#### 1.5 Delete Node
**User Story**: "As a lab user, I want to delete a node so that I can remove it from my lab and reclaim storage."

**Technical Implementation**:
- Stop node if running
- Delete overlay file
- Remove node record from PostgreSQL
- Unregister from Guacamole
- Clear any network connections (TAP interfaces)
- Set deletedAt (soft delete) or hard delete

**API Endpoint**:
```
DELETE /api/nodes/:id
Response (200):
{
  "success": true,
  "message": "Node deleted successfully",
  "id": "uuid-abc123"
}
```

**Frontend Components**:
- NodeCard "Delete" button (trash icon)
- Confirmation dialog ("Delete node permanently?")

**Edge Cases**:
- Node has active connections → Confirm before deleting
- Overlay file missing → Still delete record (cleanup)
- Node being referenced by lab template → Return 400 'Cannot delete: referenced by lab'

---

### **Feature Module 2: Dual Console Access** ✅ (PHASE 0 - DONE)
**Status**: VNC + serial implemented | Pending: WebSocket pooling, connection reuse

#### 2.1 VNC Console (Graphical Desktop)
**User Story**: "As a network engineer, I want graphical console access so that I can use GUI tools and observe system behavior visually."

**Technical Implementation**:
- QEMU spawned with `-vnc 0.0.0.0:5900` flag
- Apache Guacamole runs in docker-compose, connects to VNC port
- Guacamole proxies VNC → WebSocket (HTML5 canvas rendering in browser)
- GuacamoleClient registers connection in PostgreSQL (auto-discovery)
- Frontend embeds Guacamole iframe: `<iframe src="http://localhost:8080/guacamole/#/client/c/{connectionId}">`
- WebSocket connection from browser → Guacamole daemon → QEMU VNC port

**API Endpoint** (via Guacamole):
```
GET /api/nodes/:id/console/vnc
Response (200):
{
  "type": "vnc",
  "url": "http://localhost:8080/guacamole/#/client/c/123",
  "protocol": "vnc",
  "host": "localhost",
  "port": 5900,
  "width": 1024,
  "height": 768,
  "connectionId": 123
}
```

**Frontend Components**:
- ConsoleViewer component (iframe embed)
- VNC settings panel (resolution, keyboard layout)
- Clipboard sync (Guacamole native)

**Edge Cases**:
- VNC port unreachable → Return 503
- Guacamole daemon down → Return 502
- Browser WebSocket blocked → Fallback to HTTP polling (Guacamole auto)

#### 2.2 Serial Console (CLI Access)
**User Story**: "As a network engineer, I want serial console access so that I can configure routers and access low-level system logs."

**Technical Implementation**:
- QEMU spawned with `-serial stdio` (STDOUT pipes to Node.js process)
- Express backend creates WebSocket endpoint: `ws://localhost:3001/ws/console/:nodeId`
- Node.js captures QEMU STDOUT → broadcasts to connected WebSocket clients
- Frontend runs xterm.js terminal UI
- Keyboard input from xterm.js → WebSocket → Node.js STDIN → QEMU serial

**WebSocket Endpoint**:
```
WS /ws/console/:nodeId
Client → Server (Terminal Input):
{ "type": "input", "data": "show version\r\n" }

Server → Client (Terminal Output):
{ "type": "output", "data": "[+] Cisco IOS Router\n\r" }
```

**Frontend Components**:
- XtermTerminal component (xterm.js wrapper)
- Terminal theme selector (dark/light)
- Copy/paste support (browser clipboard API)
- Log download (export session transcript)

**Edge Cases**:
- Serial port closed unexpectedly → Reconnect with backoff
- QEMU crashed → WebSocket close event, UI shows "Connection lost"
- Terminal resize → Send resize event to QEMU via `-serial stdio` control sequences

---

### **Feature Module 3: Network Topology Canvas** 🔄 (PHASE 1 - PLANNED)
**Status**: Not yet implemented | Planned: 30-40 hours, Week 2

#### 3.1 Canvas Node Editor (Drag-Drop)
**User Story**: "As a lab designer, I want to drag nodes onto a canvas and connect them visually so that I can design complex topologies without CLI commands."

**Technical Implementation**:
- Frontend: React Flow (reactflow npm package, MIT licensed)
- Nodes = VM instances (fetched from backend /api/nodes, synced in React state)
- Edges = Network connections (TAP interfaces, VLAN links)
- Physics-based layout (force-directed auto-arrangement)
- Canvas state stored in React Context + persistent to localStorage (auto-save)
- Optional: Export topology → JSON → POST /api/labs to persist

**API Endpoints**:
```
POST /api/labs
{
  "name": "BGP Lab v1",
  "topologyJson": {
    "nodes": [
      { "id": "router-1", "data": { "label": "router-1", "osType": "cisco-ios" }, "position": { "x": 100, "y": 100 } },
      { "id": "router-2", "data": { "label": "router-2", "osType": "cisco-ios" }, "position": { "x": 400, "y": 100 } }
    ],
    "edges": [
      { "id": "r1-r2", "source": "router-1", "target": "router-2", "data": { "interface": "eth0 ↔ eth0" } }
    ]
  }
}
Response (201):
{
  "id": "lab-uuid",
  "name": "BGP Lab v1",
  "topologyJson": {...},
  "createdAt": "2025-12-06T14:50:00Z"
}

GET /api/labs/:id
Response (200):
{
  "id": "lab-uuid",
  "name": "BGP Lab v1",
  "topologyJson": {...}
}
```

**Frontend Components**:
- Canvas component (ReactFlow container)
- NodeCard (drag-able, shows node data)
- EdgeUI (connection visual, delete button)
- ContextMenu (right-click add node, connect)
- Toolbar (zoom, fit-to-screen, save, export)

**Edge Cases**:
- Connection between non-existent nodes → Validate in backend, return 404
- Circular topology → Warn but allow (network loop simulation)
- Large canvas (100+ nodes) → Virtualize rendering, lazy load nodes

---

### **Feature Module 4: Custom Image Management** ✅ (PHASE 0 - PARTIAL)
**Status**: Upload implemented | Pending: Validation, deletion, bulk operations

#### 4.1 Upload Custom Image
**User Story**: "As a lab admin, I want to upload custom QCOW2 images so that I can use specialized OS or device simulators."

**Technical Implementation**:
- Multer middleware receives multipart/form-data upload
- Validates file extension (.qcow2, .img, .raw, .vmdk)
- Validates file size (max 10GB per limit)
- Stores in `/images/<filename>`
- If format != qcow2, auto-converts: `qemu-img convert -f <fmt> -O qcow2 <input> <output>`
- Validates output: `qemu-img info <output>` to ensure integrity
- Inserts image record in PostgreSQL `images` table
- Returns image metadata with path

**API Endpoint**:
```
POST /api/images
Content-Type: multipart/form-data
{
  "file": <binary>,
  "osType": "custom-router",
  "name": "vyos-1.4"
}
Response (201):
{
  "id": "image-uuid",
  "name": "vyos-1.4",
  "path": "/images/vyos-1.4.qcow2",
  "format": "qcow2",
  "sizeGb": 2.5,
  "osType": "custom-router",
  "isValid": true,
  "createdAt": "2025-12-06T14:55:00Z"
}
```

**Frontend Components**:
- ImageUploadForm (drag-and-drop, progress bar)
- ImageLibrary (list of uploaded images, delete buttons)
- PreviewModal (shows image metadata)

**Edge Cases**:
- File > 10GB → Return 413 Payload Too Large
- Unsupported format → Return 400
- Disk full → Return 507 Insufficient Storage
- Upload interrupted → Resume support via Content-Range (future)
- Invalid QCOW2 after conversion → Return 400, cleanup temp files

#### 4.2 List/Validate Images
**User Story**: "As an admin, I want to validate custom images to ensure they're bootable before using them in labs."

**Technical Implementation**:
- GET /api/images: List all available images (system + custom)
- POST /api/images/:id/validate: Run `qemu-img info` + `qemu-img check` on image
- Mark isValid = true/false based on checks
- Store validation errors in database

**API Endpoint**:
```
GET /api/images
Response (200):
{
  "images": [
    { "id": "img-1", "name": "ubuntu-24-lts", "format": "qcow2", "sizeGb": 3.2, "isValid": true, "osType": "ubuntu" },
    { "id": "img-2", "name": "vyos-1.4", "format": "qcow2", "sizeGb": 2.5, "isValid": true, "osType": "custom" }
  ]
}

POST /api/images/:id/validate
Response (200):
{
  "id": "image-uuid",
  "isValid": true,
  "validationErrors": null,
  "lastValidatedAt": "2025-12-06T14:57:00Z"
}
```

#### 4.3 Delete Image
**User Story**: "As an admin, I want to delete unused images to free up storage."

**Technical Implementation**:
- Check if image is referenced by active nodes/labs → 400 error if yes
- Delete filesystem file: `rm /images/<filename>`
- Soft-delete database record (set deletedAt)

**API Endpoint**:
```
DELETE /api/images/:id
Response (200):
{
  "success": true,
  "message": "Image deleted"
}
```

**Edge Cases**:
- Image in use by running node → Return 400 'Image in use'
- File already deleted → Still update database, return 200

---

### **Feature Module 5: Lab Orchestration & Persistence** 🔄 (PHASE 2 - PLANNED)
**Status**: Partial (node CRUD exists) | Pending: Multi-node templates, export/import

#### 5.1 Create Lab from Template
**User Story**: "As a trainer, I want to create a pre-configured lab from a template so that students start with consistent topologies."

**Technical Implementation**:
- Lab template = JSON file with nodes array + connections array
- POST /api/labs: Deserialize template, create multiple nodes, set up TAP interfaces
- Each node gets unique overlay from shared base image
- All nodes assigned to same labId (PostgreSQL FK)
- Transactional: If any node creation fails, rollback all

**API Endpoint**:
```
POST /api/labs
{
  "name": "BGP Lab - Spring 2025",
  "templateName": "BGP_SETUP",
  "topologyJson": {
    "nodes": [
      { "id": "router-1", "osType": "cisco-ios", "resources": { "vcpus": 2, "memoryMb": 2048 } },
      { "id": "router-2", "osType": "cisco-ios", "resources": { "vcpus": 2, "memoryMb": 2048 } },
      { "id": "router-3", "osType": "cisco-ios", "resources": { "vcpus": 2, "memoryMb": 2048 } }
    ],
    "connections": [
      { "source": "router-1", "target": "router-2", "sourceIface": "eth0", "targetIface": "eth0" },
      { "source": "router-2", "target": "router-3", "sourceIface": "eth1", "targetIface": "eth0" }
    ]
  }
}
Response (201):
{
  "id": "lab-uuid",
  "name": "BGP Lab - Spring 2025",
  "nodeIds": ["node-1", "node-2", "node-3"],
  "connectionIds": ["conn-1", "conn-2"],
  "createdAt": "2025-12-06T15:00:00Z"
}
```

#### 5.2 Export Lab (Snapshot)
**User Story**: "As a trainer, I want to export a configured lab so that I can share it with colleagues or archive it for future use."

**Technical Implementation**:
- GET /api/labs/:id/export: Serialize lab metadata + node configs + connections to JSON
- Include node status snapshots (for history)
- Return downloadable JSON file

**API Endpoint**:
```
GET /api/labs/:id/export
Response (200 + Content-Disposition: attachment):
{
  "name": "BGP Lab - Spring 2025",
  "exportedAt": "2025-12-06T15:02:00Z",
  "nodes": [...],
  "connections": [...],
  "metadata": { "version": "1.0", "creator": "user-uuid" }
}
```

#### 5.3 Import Lab (Restore)
**User Story**: "As a trainer, I want to import a previously exported lab so that I can quickly spin up known topologies."

**Technical Implementation**:
- POST /api/labs/import: Parse uploaded JSON, validate schema
- Create new lab record with deserialized topology
- Trigger node creation for each entry

**API Endpoint**:
```
POST /api/labs/import
Content-Type: application/json
{
  "labJson": { /* exported JSON */ }
}
Response (201):
{
  "id": "new-lab-uuid",
  "name": "BGP Lab - Spring 2025 (Imported)",
  ...
}
```

---

### **Feature Module 6: Security & Multi-Tenancy** 🔄 (PHASE 1 - PLANNED)
**Status**: Not implemented | Planned: 15-20 hours

#### 6.1 JWT Authentication
**User Story**: "As a security officer, I want all API requests authenticated so that unauthorized users cannot modify labs or access consoles."

**Technical Implementation**:
- Express middleware: `express-jwt` validates Authorization: Bearer <token>
- JWT payload: `{ userId, email, role, iat, exp }`
- Protected routes: All `/api/*` except `/api/health` and `/api/auth/login`
- Auth service: User login returns JWT token (valid 24h)
- Token refresh: Endpoint to obtain new token before expiry

**API Endpoint**:
```
POST /api/auth/login
{
  "email": "user@org.com",
  "password": "secret"
}
Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "user": { "id": "user-uuid", "email": "user@org.com", "role": "admin" }
}
```

#### 6.2 RBAC (Role-Based Access Control)
**User Story**: "As an admin, I want to control who can create/delete labs so that training environments are protected."

**Technical Implementation**:
- Roles: admin, instructor, student, viewer
- Policies: 
  - Admin: All operations
  - Instructor: Create/manage own labs, create/delete nodes
  - Student: Read own labs, start/stop nodes (not create)
  - Viewer: Read-only access to shared labs
- Middleware checks role + resource ownership before allowing operation

**Policy Examples**:
```
POST /api/nodes (only Admin, Instructor can create)
DELETE /api/labs/:id (only owner + Admin)
GET /api/labs/:id (owner + Admin + invited users)
```

#### 6.3 Audit Logging
**User Story**: "As a compliance officer, I want all actions logged so that we have a full audit trail for security investigations."

**Technical Implementation**:
- Every state-changing operation (POST, PUT, DELETE) logs to auditLog table
- Fields: userId, action, resourceType, resourceId, timestamp, ipAddress, success/failure
- Retention: 1 year (configurable)

**Logged Actions**:
```
CREATE_NODE, START_VM, STOP_VM, DELETE_VM, UPLOAD_IMAGE, DELETE_IMAGE,
CREATE_LAB, DELETE_LAB, EXPORT_LAB, IMPORT_LAB, UPDATE_USER, CHANGE_PASSWORD
```

---

## 5. Analytics & Data Hooks

### Key Metrics for MVP Success

| Event | Trigger | Purpose | Data Collected |
|-------|---------|---------|-----------------|
| **node_created** | POST /api/nodes | Track lab adoption | nodeId, osType, userId, timestamp |
| **node_started** | POST /api/nodes/:id/run | Measure engagement | nodeId, bootTime, userId, timestamp |
| **node_stopped** | POST /api/nodes/:id/stop | Session duration | nodeId, uptimeSec, userId, timestamp |
| **console_accessed** | WebSocket connect | Feature adoption | nodeId, consoleType (vnc/serial), userId, timestamp |
| **lab_created** | POST /api/labs | Template usage | labId, templateName, nodeCount, userId |
| **image_uploaded** | POST /api/images | Custom content | imageId, sizeGb, osType, userId, timestamp |
| **lab_exported** | GET /api/labs/:id/export | Sharing behavior | labId, userId, timestamp |
| **lab_imported** | POST /api/labs/import | Reuse patterns | sourceLabId, newLabId, userId |
| **api_error** | Any endpoint | Reliability | endpoint, errorCode, errorMsg, timestamp |
| **user_login** | POST /api/auth/login | Engagement | userId, timestamp, ipAddress |

### Analytics Queries (Future Dashboard)

```sql
-- Active labs per day
SELECT DATE(createdAt), COUNT(DISTINCT labId) as active_labs
FROM nodes
WHERE deletedAt IS NULL
GROUP BY DATE(createdAt)
ORDER BY DATE(createdAt) DESC;

-- Average time to first console access
SELECT AVG(EXTRACT(EPOCH FROM (console_access_time - node_start_time))) as avg_time_to_console
FROM analytics
WHERE node_started = TRUE AND console_accessed = TRUE;

-- Most popular templates
SELECT templateName, COUNT(*) as usage_count
FROM labs
WHERE deletedAt IS NULL
GROUP BY templateName
ORDER BY usage_count DESC
LIMIT 10;
```

---

## 6. Non-Functional Requirements

### 6.1 Security

#### Data Protection
- **At Rest**: Overlay QCOW2 files encrypted (optional LUKS support)
- **In Transit**: TLS 1.3 enforced for all connections (reverse proxy)
- **PII Handling**: User emails encrypted in database, masked in logs
- **Secrets**: All credentials (DB, Guacamole) in environment variables, never committed

#### Input Validation
- Node names: `^[a-zA-Z0-9_-]{1,50}$` (prevent shell injection)
- OS types: Whitelist only (`ubuntu`, `debian`, `cisco-ios`, `custom`)
- File uploads: Magic number check (not just extension), max 10GB
- JSON payloads: Schema validation with ajv library

#### Output Encoding
- JSON: Default safe (JSON.stringify)
- HTML: Escape special characters in error messages (prevent XSS)
- SQL: Parameterized queries (via pg library, no string concatenation)

#### Access Control
- Authentication: JWT (stateless, no session overhead)
- Authorization: Role-based middleware on all protected routes
- Rate Limiting: 100 requests/min per IP, 10 requests/min per user on expensive operations

#### Compliance
- GDPR: User deletion triggers cascade deletion of labs/nodes
- Data Retention: Delete soft-deleted records after 90 days
- Audit: Every action logged with user/timestamp/IP

### 6.2 Scalability

#### Horizontal Scaling (Phase 3)
- **Stateless API**: No in-memory state; all state in PostgreSQL + Redis
- **Load Balancing**: Reverse proxy (nginx) distributes across multiple backend instances
- **Database Sharding**: Future: shard by userId (labs/nodes partitioned)
- **Job Queue**: BullMQ + Redis for long-running operations (VM start/stop)

#### Vertical Scaling (Current)
- **Single Host Limits**:
  - ~50-100 concurrent VMs per host (depends on resources)
  - Overlay storage: 10MB per VM (100 VMs = 1GB)
  - Memory: Each VM = 1-2GB (50 VMs = 50-100GB host memory)
  - CPU: Each VM = 1-2 vCPU (ensure sufficient host CPU)

#### Performance Targets
| Operation | Target | Implementation |
|-----------|--------|-----------------|
| VM Boot | < 10s | KVM acceleration + SSD storage |
| API Response | < 500ms | Node.js non-blocking, DB indexing |
| VNC Latency | < 100ms | Guacamole local WebSocket |
| Serial Console | < 50ms | Direct stdio piping |
| Image Upload | < 60s (1GB) | Async conversion, progress streaming |

#### Monitoring
- **CPU/Memory**: Docker stats, alert if > 80%
- **Disk**: Monitor `/images` and `/overlays` free space
- **Database**: Monitor connection pool, slow queries (> 1s)
- **API**: Response time percentiles (p50, p95, p99), error rates

### 6.3 Reliability

#### Graceful Degradation
- Guacamole down: VNC unavailable, but serial console still works
- Database down: API returns 503, UI shows "Service Maintenance"
- QEMU crash: Detect via PID check, log error, mark node as failed

#### Data Backup
- PostgreSQL: Daily backup to S3 (WAL archiving)
- Overlay images: Backed up to secondary disk (future)
- Configuration: Version-controlled in git

#### Disaster Recovery
- **RTO** (Recovery Time Objective): 1 hour (restore DB from backup)
- **RPO** (Recovery Point Objective): 15 minutes (hourly snapshots)
- Tested quarterly

### 6.4 Implementation Layers Status

```
LAYER                        STATUS              IMPLEMENTATION %
─────────────────────────────────────────────────────────────────
Infrastructure (Docker)      ✅ DONE             100% (docker-compose.yml)
Backend API Core             ✅ DONE             95% (server.js, managers)
  • Node CRUD                 ✅ DONE             100%
  • Console Access            ✅ DONE             100%
  • Image Upload              ✅ DONE             90%
Database Schema              ✅ DONE             70% (nodes table full, others partial)
Frontend UI                  🔄 IN PROGRESS      60% (basic components, no canvas)
  • Node Dashboard            ✅ DONE             80%
  • Console Viewers           ✅ DONE             90%
  • Canvas Editor             ⏳ PLANNED          0%
Authentication               ⏳ PLANNED          0%
Logging & Monitoring         ⏳ PLANNED          0%
CI/CD Pipeline               ⏳ PLANNED          0%
TypeScript Migration         ⏳ PLANNED          0%
─────────────────────────────────────────────────────────────────
OVERALL PRODUCT READINESS:                      ~65%
```

### 6.5 Self-Reflection & AI Coder Integration

**For AI Coding Agents (Copilot/Claude):**

This PRD serves as your "context window" for development. When assigned a feature ticket:

1. **Check Implementation Status** (above table)
2. **Read Relevant Feature Module** (Section 4)
3. **Verify Current Code** (check backend/modules/*, frontend/components/*)
4. **Identify Gaps**: What's missing vs. spec?
5. **Implement Incrementally**: One endpoint/component at a time
6. **Test & Validate**: Against edge cases in spec
7. **Update Status**: Mark feature complete when done
8. **Ask Clarifying Questions**: If requirements ambiguous, reference specific PRD section

**Example Assignment Flow:**

```
TICKET: Implement GET /api/nodes/:id endpoint

Agent Steps:
  1. Read Feature Module 1.2 (Node Lifecycle)
  2. Check backend/modules/nodeManager.js for getNode() implementation
  3. Verify PostgreSQL schema (nodes table defined in Section 3)
  4. Implement: app.get('/api/nodes/:id', handler)
  5. Handle edge cases: node not found → 404, invalid UUID → 400
  6. Test: curl http://localhost:3001/api/nodes/uuid-123
  7. Commit with message: "Feat: GET /api/nodes/:id endpoint (Feature Module 1.2)"
```

**Codebase Checkpoints for Verification:**

- ✅ `backend/server.js`: All 8 API endpoints defined
- ✅ `backend/modules/nodeManager.js`: CRUD operations exist
- ✅ `backend/modules/qemuManager.js`: VM lifecycle methods
- ✅ `backend/modules/guacamoleClient.js`: VNC registration
- ✅ `docker-compose.yml`: All services configured
- ⏳ `frontend/components/`: Basic components, missing canvas/auth
- ⏳ `backend/middleware/`: No auth middleware yet
- ⏳ `tests/`: Minimal test coverage

---

## Summary: Build Order (Prioritized)

1. **Phase 0 (Done)**: Core infrastructure, node CRUD, console access
2. **Phase 1 (5 days)**: JWT auth, Swagger spec, structured logging, CI/CD
3. **Phase 2 (Weeks 2-3)**: TypeScript, E2E tests, resource limits, canvas UI
4. **Phase 3 (Month 2)**: Kubernetes ready, RBAC, multi-tenancy
5. **Phase 4 (Q2+)**: Job queue, Wireshark integration, advanced templates

**Go/No-Go**: ✅ **GO** - You're 65% complete. 5 days to production grade.

---

**Document Version**: 1.0 | **Last Updated**: 2025-12-06 | **Next Review**: Weekly
