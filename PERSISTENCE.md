# VM Persistence Architecture

## Overview

SandBoxLabs uses a layered persistence strategy to ensure VM data, state, and configuration survive container restarts and `docker compose down/up` cycles.

## Persistence Layers

### 1. **VM Disk Overlays** (`./overlays/`)
- **Type**: Bind mount (host directory)
- **Location**: `./overlays/` → `/overlays` (in container)
- **Content**: QCOW2 overlay files for each VM
- **Persistence**: Survives container restarts and docker compose down
- **Purpose**: Stores all changes made to VM disks (files, packages, configurations)

Each VM gets its own overlay file named `node_<uuid>.qcow2` which contains all modifications made to the base image.

### 2. **Backend State File** (`backend_state` volume)
- **Type**: Docker named volume
- **Location**: `backend_state` volume → `/app/state/` (in container)
- **File**: `/app/state/nodes-state.json`
- **Content**: VM metadata (names, IDs, status, ports, timestamps)
- **Persistence**: Survives container restarts and docker compose down
- **Purpose**: Tracks which VMs exist and their configuration

The state file contains:
```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-20T12:00:00.000Z",
  "nodes": [
    {
      "id": "uuid",
      "name": "VM Name",
      "osType": "ubuntu|debian|alpine",
      "status": "running|stopped",
      "overlayPath": "/overlays/node_<uuid>.qcow2",
      "vncPort": 5900,
      "resources": { "ram": 2048, "cpus": 2 },
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

### 3. **PostgreSQL Database** (`postgres_data` volume)
- **Type**: Docker named volume
- **Location**: `postgres_data` volume → `/var/lib/postgresql/data` (in container)
- **Content**: Guacamole connection history, user data
- **Persistence**: Survives container restarts and docker compose down
- **Purpose**: Stores Guacamole authentication and connection records

### 4. **Base Images** (`./images/`)
- **Type**: Bind mount (host directory)
- **Location**: `./images/` → `/images` (in container)
- **Content**: Base QCOW2 images (Ubuntu, Debian, Alpine)
- **Persistence**: Permanent (part of repository or downloaded once)
- **Purpose**: Read-only templates for creating new VMs

## Data Flow

### Creating a New VM
1. User requests VM creation via API
2. Backend generates UUID and creates node entry in state file
3. Backend creates QCOW2 overlay backed by base image
4. Overlay is stored in `./overlays/node_<uuid>.qcow2`
5. State is saved to `/app/state/nodes-state.json`

### Starting a VM
1. Backend reads node state from `/app/state/nodes-state.json`
2. Backend verifies overlay exists at `/overlays/node_<uuid>.qcow2`
3. QEMU VM is launched using the overlay
4. All disk changes are written to the overlay
5. VM metadata (PID, port, status) is updated in state file

### Stopping a VM
1. Backend sends stop signal to QEMU process
2. QEMU flushes all disk changes to overlay file
3. VM status is updated in state file
4. Overlay remains on disk with all changes preserved

### Container Restart Cycle
1. `docker compose down` - Containers stop, volumes persist
2. `docker compose up` - Containers restart
3. Backend reads `/app/state/nodes-state.json` from volume
4. Backend finds overlays in `/overlays/` directory
5. VMs are in "stopped" state and ready to start
6. User can resume any VM with all data intact

## Fresh Environment Setup

When starting with a clean environment (new clone, new user):

1. **First Run**: `docker compose up`
   - Creates empty `backend_state` volume
   - Creates empty `postgres_data` volume
   - Creates `./overlays/` directory (if not exists)
   - Initializes empty state file: `{"version": "1.0.0", "nodes": []}`
   - No VMs are pre-populated (clean slate)

2. **User Creates VMs**: VMs are created on-demand via the UI
   - Each VM gets its own overlay file
   - State is tracked in persistent volume

3. **Subsequent Runs**: `docker compose down && docker compose up`
   - All VM data and state is preserved
   - VMs can be resumed exactly where left off

## Directory Structure

```
sandboxlabs/
├── images/                     # Base QCOW2 images (bind mount)
│   ├── ubuntu-24-lts.qcow2
│   ├── debian-13.qcow2
│   └── alpine-3.qcow2
├── overlays/                   # VM overlays (bind mount)
│   ├── .gitkeep                # Tracked in git
│   ├── node_<uuid-1>.qcow2     # NOT tracked (runtime)
│   ├── node_<uuid-2>.qcow2     # NOT tracked (runtime)
│   └── ...
└── docker-compose.yml

Docker Volumes:
- sandlabx-backend-state        # Mounted at /app/state/
  └── nodes-state.json          # VM metadata
- sandlabx-postgres-data        # Mounted at /var/lib/postgresql/data/
  └── (PostgreSQL files)
```

## Environment Variables

Key environment variables for persistence:

```bash
STATE_FILE=/app/state/nodes-state.json  # State file location (in volume)
OVERLAYS_PATH=/overlays                 # Overlay directory (bind mount)
BASE_IMAGE_PATH=/images/alpine-3.qcow2  # Default base image
```

## Backup and Migration

### Backing Up VMs
To backup all VMs and their state:

```bash
# Backup overlays (VM disk data)
tar -czf vm-overlays-backup.tar.gz overlays/

# Backup state file
docker compose cp backend:/app/state/nodes-state.json nodes-state-backup.json

# Backup PostgreSQL database (optional)
docker exec sandlabx-postgres pg_dump -U guacamole guacamole_db > guacamole-backup.sql
```

### Restoring VMs
To restore VMs on a new machine:

```bash
# Restore overlays
tar -xzf vm-overlays-backup.tar.gz

# Restore state file
docker compose up -d backend
docker compose cp nodes-state-backup.json backend:/app/state/nodes-state.json
docker compose restart backend

# Restore PostgreSQL database (optional)
docker compose exec -T postgres psql -U guacamole guacamole_db < guacamole-backup.sql
```

## Troubleshooting

### VMs Not Appearing After Restart

**Problem**: VMs disappear after `docker compose down && up`

**Check**:
1. Verify state file exists in volume:
   ```bash
   docker exec sandlabx-backend cat /app/state/nodes-state.json
   ```

2. Verify overlays exist on host:
   ```bash
   ls -lh overlays/*.qcow2
   ```

3. Check volume mounts:
   ```bash
   docker inspect sandlabx-backend --format '{{json .Mounts}}' | jq
   ```

**Fix**: If state file is empty or missing, it means it was never written to the persistent volume. Check `STATE_FILE` environment variable points to `/app/state/nodes-state.json`.

### Overlays Not Persisting

**Problem**: VM changes are lost after restart

**Check**:
1. Verify overlay is bind-mounted, not a volume:
   ```bash
   docker compose config | grep -A 5 "overlays"
   ```

2. Check overlay file size is growing:
   ```bash
   ls -lh overlays/node_*.qcow2
   ```

**Fix**: Ensure `docker-compose.yml` uses `./overlays:/overlays:rw` (bind mount), not a named volume.

### State File Not Persisting

**Problem**: VM state resets to empty on restart

**Check**:
1. Verify `STATE_FILE` environment variable:
   ```bash
   docker exec sandlabx-backend printenv STATE_FILE
   ```
   Should be: `/app/state/nodes-state.json`

2. Verify volume mount:
   ```bash
   docker inspect sandlabx-backend | grep -A 10 "Mounts"
   ```
   Should show: `backend_state` → `/app/state`

**Fix**: Ensure `STATE_FILE=/app/state/nodes-state.json` in `docker-compose.yml` environment section.

## Best Practices

1. **Never delete volumes manually** unless you want to lose all data
2. **Backup overlays before major changes** (they can grow large)
3. **Clean up unused VMs** via the API to free disk space
4. **Monitor disk usage** as overlays can grow significantly
5. **Use `docker compose down`** (not `docker compose down -v`) to preserve volumes

## Migration from Previous Setup

If you're upgrading from a version that stored state in the container:

```bash
# 1. Stop services
docker compose down

# 2. Copy old state file to new location
docker compose up -d backend
docker compose exec backend mkdir -p /app/state
docker compose cp backend:/app/nodes-state.json /tmp/state-backup.json
docker compose cp /tmp/state-backup.json backend:/app/state/nodes-state.json

# 3. Update docker-compose.yml STATE_FILE to /app/state/nodes-state.json

# 4. Restart
docker compose restart backend
```

## Summary

This architecture ensures:
- ✅ VMs persist across container restarts
- ✅ VM state survives `docker compose down/up`
- ✅ Fresh environments start empty (no default VMs)
- ✅ Data can be backed up and migrated
- ✅ Overlays use copy-on-write for efficiency
- ✅ Base images are shared across all VMs
