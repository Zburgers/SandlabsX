# Docker KVM Access Fix

## Problem
Router works with KVM on laptop terminal but fails in Docker:
```
Could not access KVM kernel module: No such file or directory
qemu-system-x86_64: failed to initialize kvm: No such file or directory
```

## Root Cause
Docker container doesn't have access to `/dev/kvm` device

## Solution
Added device mapping in `docker-compose.yml`:

```yaml
backend:
  devices:
    - /dev/kvm:/dev/kvm          # KVM hardware acceleration
    - /dev/net/tun:/dev/net/tun  # TAP/TUN for networking
```

## How the Router Actually Starts

### 1. Base Image (Direct Use - No Overlay)
- Router uses: `/images/router.qcow2` directly
- NVRAM: Stored in same disk or separate file

### 2. QEMU Command
```bash
qemu-system-x86_64 \
  -drive file=/images/router.qcow2,format=qcow2 \
  -m 512 \
  -nographic \
  -serial mon:stdio \
  -device e1000,netdev=net0 \
  -netdev user,id=net0 \
  -device e1000,netdev=net1 \
  -netdev user,id=net1 \
  -enable-kvm   # Now works because /dev/kvm is mounted!
```

### 3. Network Interfaces
- **e1000,netdev=net0** → First network interface
- **e1000,netdev=net1** → Second network interface
- Both can communicate with other devices in network lab

## Testing
```bash
# Restart container with new config
docker-compose down
docker-compose up -d backend

# Verify KVM access inside container
docker exec sandlabx-backend ls -l /dev/kvm
# Should show: crw-rw-rw- 1 root kvm 10, 232 /dev/kvm

# Test router startup
# Create router node in UI and start it
# Should boot successfully with KVM acceleration
```

## Why This Works
1. Host has `/dev/kvm` (verified)
2. Docker mounts `/dev/kvm` into container
3. QEMU inside container can now access KVM
4. Router boots with hardware acceleration
5. Same behavior as running on laptop terminal

---
**Fix Applied** ✅
