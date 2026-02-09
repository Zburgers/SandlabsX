# VM Persistence Implementation Summary

## Problem Statement

Previously, when running `docker compose down` and then `docker compose up`, the environment would reset and VMs would be lost. The system had three default servers (Debian, Alpine, Ubuntu) that didn't function properly, and session progress was not preserved between restarts.

## Root Cause Analysis

The issue was caused by:

1. **State file stored in ephemeral container filesystem**: The `STATE_FILE` environment variable pointed to `/app/nodes-state.json`, which was inside the container but NOT in the mounted volume path (`/app/state/`). When the container was destroyed, the state file was lost.

2. **Overlays using Docker volume instead of bind mount**: The overlay files were being stored in a Docker named volume instead of a bind-mounted host directory, making them harder to access and backup.

3. **No migration path**: Users upgrading from previous versions had no automated way to migrate their existing VM state.

## Solution Implemented

### 1. Fixed State File Persistence

**Before:**
```yaml
environment:
  STATE_FILE: /app/nodes-state.json  # ❌ Not in persistent volume
volumes:
  - backend_state:/app/state          # Volume mounted but not used
```

**After:**
```yaml
environment:
  STATE_FILE: /app/state/nodes-state.json  # ✅ Inside persistent volume
volumes:
  - backend_state:/app/state               # Volume properly utilized
```

### 2. Changed Overlays to Bind Mount

**Before:**
```yaml
volumes:
  - overlays_data:/overlays  # ❌ Docker volume (opaque)
```

**After:**
```yaml
volumes:
  - ./overlays:/overlays:rw  # ✅ Bind mount (accessible on host)
```

### 3. Fixed Overlay Path Generation

Updated `backend/modules/nodeManager.js` to use container-relative paths:

**Before:**
```javascript
overlayPath: path.join(process.env.OVERLAYS_PATH || '../overlays', `node_${id}.qcow2`)
// Generated: ../overlays/node_<uuid>.qcow2 (relative, breaks in container)
```

**After:**
```javascript
const overlaysPath = process.env.OVERLAYS_PATH || '/overlays';
overlayPath: path.join(overlaysPath, `node_${id}.qcow2`)
// Generated: /overlays/node_<uuid>.qcow2 (absolute, works in container)
```

### 4. Created Migration Script

Created `migrate-state.sh` to help existing users migrate their state file from the old location to the new persistent volume location.

### 5. Added Comprehensive Documentation

- **PERSISTENCE.md**: Complete guide to the persistence architecture
- **README.md**: Added data persistence section with migration instructions
- **Code comments**: Improved documentation in critical modules

## Architecture

### Persistence Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Persistence Layers                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. VM Disk Overlays (./overlays/)                          │
│     - Type: Bind mount (host directory)                      │
│     - Content: QCOW2 overlay files                          │
│     - Persistence: ✅ Survives container restarts           │
│                                                               │
│  2. Backend State File (backend_state volume)                │
│     - Type: Docker named volume                              │
│     - Location: /app/state/nodes-state.json                 │
│     - Content: VM metadata (names, IDs, status)             │
│     - Persistence: ✅ Survives docker compose down          │
│                                                               │
│  3. PostgreSQL Database (postgres_data volume)               │
│     - Type: Docker named volume                              │
│     - Content: Guacamole connections, user data             │
│     - Persistence: ✅ Survives docker compose down          │
│                                                               │
│  4. Base Images (./images/)                                  │
│     - Type: Bind mount (host directory)                      │
│     - Content: Base QCOW2 images                            │
│     - Persistence: ✅ Permanent (part of repository)        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Testing Results

### Test 1: Container Restart
```bash
docker compose down
docker compose up -d
curl http://localhost:3001/api/nodes
```
**Result**: ✅ All 3 VMs successfully restored

### Test 2: State File Verification
```bash
docker exec sandlabx-backend cat /app/state/nodes-state.json
```
**Result**: ✅ State file persisted in volume with correct data

### Test 3: Overlay Files
```bash
ls -lh overlays/*.qcow2
docker exec sandlabx-backend ls -lh /overlays/
```
**Result**: ✅ All overlay files accessible from both host and container

### Test 4: Path Correctness
```bash
curl http://localhost:3001/api/nodes | jq -r '.nodes[].overlayPath'
```
**Result**: ✅ All paths use container format: `/overlays/node_<uuid>.qcow2`

## Benefits

1. **✅ Data Persistence**: VMs and their state survive container restarts
2. **✅ Clean Fresh Starts**: New environments start empty (no default VMs)
3. **✅ Easy Backups**: Overlay files are on host, easily backed up
4. **✅ Migration Support**: Script provided for existing installations
5. **✅ Professional Setup**: Follows Docker best practices for data persistence
6. **✅ Documented**: Comprehensive documentation for users and developers

## Files Modified

1. **docker-compose.yml**
   - Changed `STATE_FILE` from `/app/nodes-state.json` to `/app/state/nodes-state.json`
   - Changed overlays from Docker volume to bind mount: `./overlays:/overlays:rw`
   - Removed unused `overlays_data` volume

2. **backend/modules/nodeManager.js**
   - Updated `createNode()` to use absolute container paths for overlays
   - Changed from `../overlays` to `/overlays` path format

3. **PERSISTENCE.md** (new)
   - Comprehensive documentation of persistence architecture
   - Troubleshooting guide
   - Backup and migration procedures

4. **migrate-state.sh** (new)
   - Automated migration script for existing installations
   - Backs up old state before migration
   - Verifies successful migration

5. **README.md**
   - Added Data Persistence section
   - Added link to PERSISTENCE.md
   - Updated documentation links

## Migration Path for Existing Users

For users upgrading from previous versions:

```bash
# 1. Pull latest changes
git pull origin feature/persistent-vm-storage

# 2. Stop services
docker compose down

# 3. Start services with new configuration
docker compose up -d

# 4. Migrate existing state (if any VMs exist)
./migrate-state.sh

# 5. Verify VMs are loaded
curl http://localhost:3001/api/nodes
```

## Future Enhancements

Potential improvements for future versions:

1. **Automatic Snapshots**: Periodic snapshots of VM state
2. **Cloud Backup Integration**: Sync overlays to S3/cloud storage
3. **Volume Cleanup**: Tool to remove unused overlays
4. **State Validation**: Health checks for state file integrity
5. **Import/Export**: Easy VM migration between hosts

## Conclusion

The VM persistence issue has been completely resolved. The implementation follows DevOps best practices, uses proper Docker volume strategies, and provides a clear upgrade path for existing users. All VMs and their data now reliably persist across container lifecycles, meeting all requirements specified in the problem statement.

---

**Branch**: `feature/persistent-vm-storage`  
**Commit**: `cf378c1`  
**Testing**: ✅ All tests passed  
**Documentation**: ✅ Complete  
**Migration Support**: ✅ Provided
