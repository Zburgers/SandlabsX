# 🔧 Restart Instructions - KVM Fix Applied

## What Was Fixed
Docker container now has access to `/dev/kvm` for hardware acceleration.

## Steps to Apply Fix

### 1. Stop Current Containers
```bash
docker-compose down
```

### 2. Verify Host Has KVM
```bash
ls -l /dev/kvm
# Should show: crw-rw-rw-. 1 root kvm 10, 232 /dev/kvm
```

### 3. Start Containers with New Configuration
```bash
docker-compose up -d
```

### 4. Verify KVM Access in Container
```bash
docker exec sandlabx-backend ls -l /dev/kvm
# Should show the device is accessible
```

### 5. Check Backend Logs
```bash
docker logs -f sandlabx-backend
```

### 6. Test Router
1. Open frontend: http://localhost:3000
2. Create a new router node
3. Start the router
4. Check logs - should NOT see KVM errors
5. Router should boot successfully with KVM acceleration

## Expected Behavior

### ✅ Before (Laptop Terminal)
```
qemu-system-x86_64 -enable-kvm ...
✅ Router boots with KVM
```

### ❌ Before (Docker - BROKEN)
```
Could not access KVM kernel module: No such file or directory
qemu-system-x86_64: failed to initialize kvm
```

### ✅ After (Docker - FIXED)
```
qemu-system-x86_64 -enable-kvm ...
✅ Router boots with KVM (same as laptop!)
```

## Verification Checklist
- [ ] Containers stopped
- [ ] Host has /dev/kvm
- [ ] Containers restarted
- [ ] KVM accessible in container
- [ ] Router node created
- [ ] Router starts without KVM error
- [ ] Router boots successfully

---
**Ready to test!** 🚀
