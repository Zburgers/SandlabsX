# SandBoxLabs Backend API

RESTful API server for managing QEMU VM nodes with overlay disks and Guacamole integration.

## 📚 Related Documentation

- **[Main README](../README.md)** - Complete project documentation
- **[Quick Start Guide](../QUICK-START.md)** - Get the entire system running
- **[Frontend README](../frontend/README.md)** - Frontend UI documentation
- **[Project Summary](../PROJECT-SUMMARY.md)** - Deliverables overview
- **[Documentation Index](../docs/README.md)** - All documentation files

## 🏗️ Architecture

```
backend/
├── server.js              # Main Express server
├── modules/
│   ├── nodeManager.js     # Node state management
│   ├── qemuManager.js     # QEMU VM lifecycle
│   └── guacamoleClient.js # Guacamole DB integration
├── package.json           # Dependencies
├── .env                   # Configuration
└── nodes-state.json       # Runtime state (auto-generated)
```

## 🚀 Quick Start

### Installation

```bash
cd backend
npm install
```

### Configuration

Edit `.env` file with your paths:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=guacamole_db
DB_USER=guacamole
DB_PASSWORD=guacpass123
GUAC_BASE_URL=http://localhost:8081/guacamole
BASE_IMAGE_PATH=/path/to/images/base.qcow2
OVERLAYS_PATH=/path/to/overlays
VNC_START_PORT=5900
```

### Start Server

```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

Server runs on `http://localhost:3001`

## 📡 API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and connection info.

### List Nodes
```
GET /api/nodes
```
Returns array of all nodes with current status.

**Response:**
```json
{
  "success": true,
  "nodes": [
    {
      "id": "uuid",
      "name": "node-1",
      "status": "running",
      "vncPort": 5900,
      "guacUrl": "http://...",
      "createdAt": "2025-10-14T..."
    }
  ],
  "count": 1
}
```

### Get Node Details
```
GET /api/nodes/:id
```
Returns detailed information about a specific node.

### Create Node
```
POST /api/nodes
Content-Type: application/json

{
  "name": "my-node",      // optional
  "osType": "ubuntu"      // optional
}
```

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "name": "my-node",
  "status": "stopped",
  "overlayPath": "/overlays/node_uuid.qcow2",
  "createdAt": "..."
}
```

### Start Node
```
POST /api/nodes/:id/run
```

Starts the QEMU VM and registers with Guacamole.

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "status": "running",
  "vncPort": 5900,
  "guacUrl": "http://localhost:8081/guacamole/#/client/...",
  "guacConnectionId": 1,
  "pid": 12345
}
```

### Stop Node
```
POST /api/nodes/:id/stop
```

Gracefully stops the QEMU VM.

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "status": "stopped",
  "vncPort": null,
  "guacUrl": null
}
```

### Wipe Node
```
POST /api/nodes/:id/wipe
```

Stops VM (if running), deletes overlay, and recreates from base image.

**Response:**
```json
{
  "success": true,
  "message": "Node wiped successfully",
  "id": "uuid",
  "status": "stopped"
}
```

### Delete Node
```
DELETE /api/nodes/:id
```

Completely removes node (stops VM, deletes overlay, removes from state).

**Response:**
```json
{
  "success": true,
  "message": "Node deleted successfully",
  "id": "uuid"
}
```

## 🔧 How It Works

### 1. Node Creation
- Generates unique UUID
- Creates QCOW2 overlay: `qemu-img create -f qcow2 -b base.qcow2 -F qcow2 node_<id>.qcow2`
- Stores node metadata in state file

### 2. Node Start
- Spawns QEMU process with overlay disk
- Assigns VNC port (5900, 5901, 5902, ...)
- Registers VNC connection in Guacamole PostgreSQL
- Generates Guacamole URL

### 3. Node Stop
- Sends SIGTERM to QEMU process
- Waits for graceful shutdown (5s timeout)
- Forces SIGKILL if needed
- Cleans up process references

### 4. Node Wipe
- Stops VM if running
- Deletes overlay file
- Recreates fresh overlay from base image
- Preserves node metadata

## 🗄️ State Management

Node state is persisted in `nodes-state.json`:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-14T...",
  "nodes": [
    {
      "id": "uuid",
      "name": "node-1",
      "status": "running",
      "overlayPath": "/overlays/node_uuid.qcow2",
      "vncPort": 5900,
      "guacConnectionId": 1,
      "guacUrl": "http://...",
      "pid": 12345,
      "createdAt": "...",
      "updatedAt": "...",
      "resources": {
        "ram": 2048,
        "cpus": 2
      }
    }
  ]
}
```

## 🔌 Guacamole Integration

The backend directly inserts VNC connections into Guacamole's PostgreSQL database:

1. Creates `guacamole_connection` entry
2. Sets VNC parameters (hostname, port)
3. Grants permissions to guacadmin user
4. Generates connection URL

**Database Tables Used:**
- `guacamole_connection` - Connection metadata
- `guacamole_connection_parameter` - VNC configuration
- `guacamole_connection_permission` - User access control

## 🖥️ QEMU Integration

### Overlay System
- Base image: Read-only, shared by all nodes
- Overlays: Copy-on-write, per-node changes only
- Fast creation: No disk copying needed
- Efficient storage: Only deltas stored

### VM Configuration
- **RAM:** 2048 MB (configurable via .env)
- **CPUs:** 2 cores (configurable)
- **VNC:** Enabled on dynamic ports (5900+)
- **KVM:** Auto-enabled if `/dev/kvm` available

### Process Management
- Spawned as child processes
- Detached from terminal
- Graceful shutdown with SIGTERM
- Automatic cleanup on exit

## 🛠️ Prerequisites

### System Requirements
- Node.js 18+
- QEMU/KVM installed
- PostgreSQL (via Docker Compose)
- Guacamole (via Docker Compose)

### Install QEMU (if running on host)
```bash
# Ubuntu/Debian
sudo apt-get install qemu-system-x86 qemu-utils

# Verify installation
qemu-system-x86_64 --version
qemu-img --version
```

### Base Image
You need a bootable base image at the configured path:

```bash
# Option 1: Download Ubuntu cloud image
wget https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img
mv focal-server-cloudimg-amd64.img images/base.qcow2

# Option 2: Create and install manually
qemu-img create -f qcow2 images/base.qcow2 10G
# Then boot with ISO and install OS
```

## 🧪 Testing

### Manual Testing

```bash
# 1. Create a node
curl -X POST http://localhost:3001/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"name": "test-node"}'

# 2. Start the node
curl -X POST http://localhost:3001/api/nodes/<id>/run

# 3. Check status
curl http://localhost:3001/api/nodes

# 4. Stop the node
curl -X POST http://localhost:3001/api/nodes/<id>/stop

# 5. Wipe the node
curl -X POST http://localhost:3001/api/nodes/<id>/wipe
```

### Check Running VMs

```bash
# List QEMU processes
ps aux | grep qemu-system-x86_64

# Check VNC ports
netstat -tlnp | grep 590
```

## 🐛 Troubleshooting

### "Base image not found"
- Ensure `BASE_IMAGE_PATH` in `.env` points to valid QCOW2 image
- Create or download a base image (see Prerequisites)

### "QEMU tools not found"
- Install QEMU: `sudo apt-get install qemu-system-x86 qemu-utils`
- Ensure tools are in PATH

### "Failed to connect to Guacamole database"
- Ensure Docker Compose services are running: `docker-compose up -d`
- Check PostgreSQL is accessible: `docker-compose ps`
- Verify credentials in `.env` match `docker-compose.yml`

### "Failed to start VM"
- Check overlay file exists and is readable
- Verify QEMU command in logs
- Try running QEMU command manually to see detailed errors

### Port conflicts
- Ensure VNC ports (5900+) are not in use
- Adjust `VNC_START_PORT` in `.env` if needed
- Check: `netstat -tlnp | grep 590`

## 📝 Development Notes

### Adding Features

**New endpoint:**
1. Add route in `server.js`
2. Call appropriate manager method
3. Handle errors and responses

**Modify VM config:**
- Edit `qemuManager.js` `startVM()` method
- Update QEMU args array

**Change state persistence:**
- Modify `nodeManager.js` `saveState()` method
- Can switch to PostgreSQL instead of JSON file

### Code Structure

- **server.js**: HTTP routing and middleware
- **nodeManager.js**: Business logic and state
- **qemuManager.js**: System commands and process management
- **guacamoleClient.js**: Database operations

## 🔒 Security Notes

⚠️ **Development Configuration - Requires Hardening for Production**

For production deployment, implement:
- Authentication/authorization
- Input validation and sanitization
- Rate limiting
- Process sandboxing
- Resource quotas
- Audit logging

## 📄 License

MIT - For educational/evaluation purposes

## 👨‍💻 Author

SandBoxLabs Internship Project
