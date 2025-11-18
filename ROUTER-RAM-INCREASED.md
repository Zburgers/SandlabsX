# Router RAM Increased ✅

## Change Made
**Router RAM: 512MB → 2048MB (2GB)**

## File Modified
`backend/modules/qemuManager.js` line 195

### Before
```javascript
'-m', '512',  // 512MB - too little!
```

### After
```javascript
'-m', '2048',  // 2GB - much better!
```

## New Router Configuration
```bash
qemu-system-x86_64 \
  -drive file=/overlays/node_xxx.qcow2,format=qcow2 \
  -m 2048 \                            # ← 2GB RAM
  -nographic \
  -serial mon:stdio \
  -device e1000,netdev=net0 \
  -netdev user,id=net0 \
  -device e1000,netdev=net1 \
  -netdev user,id=net1
  # -enable-kvm (if available)
```

## To Apply

### Current Router (if running)
1. Stop the router in UI
2. Start it again
3. New RAM will be applied

### New Routers
All new router nodes will automatically get 2GB RAM

## Why 2GB?
- **512MB**: Too little for Cisco IOS with routing tables
- **2GB**: Good balance for router operations
- **Enough for**: Routing protocols, interfaces, configs

## Verification
Check logs when starting router:
```bash
docker logs -f sandlabx-backend

# Should see:
🚀 Starting VM for node...
🌐 Router configuration (serial console only)
-m 2048  # ← Confirms 2GB RAM
```

---
**Backend restarted - ready to use!** ✅
