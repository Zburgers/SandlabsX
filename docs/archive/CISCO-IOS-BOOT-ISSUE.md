# Cisco IOS Router Image Boot Issue - Resolution

## Problem Summary
The VM boot failure showing "Booting 'IOS'" is caused by attempting to boot a **Cisco IOS router image** using standard x86_64 OS boot parameters. Cisco IOS images require specialized QEMU configuration.

## Root Causes

### 1. **Wrong Image Type**
- **Uploaded Image**: `router_1762805489189.qcow2` (122 MB)
- **Image Type**: Cisco IOS router firmware
- **Issue**: Cisco IOS is NOT a general-purpose operating system
- **Expected**: Linux/BSD/Windows QCOW2 images

### 2. **Incorrect Boot Configuration**
Current QEMU command:
```bash
qemu-system-x86_64 \
  -vnc 0.0.0.0:1 \
  -hda /overlays/node_XXX.qcow2 \
  -m 2048 \
  -smp 2 \
  -boot c \              # ❌ Wrong for Cisco IOS
  -vga std \
  -serial stdio
```

### 3. **KVM Access Issue**
- Current: "KVM not available, using software emulation"
- Fixed: Added `privileged: true` and `/dev:/dev` volume mount
- Status: KVM now accessible in container

## Solutions

### Option 1: Use Standard OS Images (RECOMMENDED)

**Use the pre-configured base images instead:**

```bash
# Available base images
ls -lh images/*.qcow2
-rw-r--r-- 1 naki naki 137M  alpine-3.qcow2        # Alpine Linux
-rw-r--r-- 1 naki naki 193K  bazzite-gnome.qcow2   # Bazzite (gaming-focused)
-rw-r--r-- 1 naki naki 387M  debian-13.qcow2       # Debian Linux
-rw-r--r-- 1 naki naki 596M  ubuntu-24-lts.qcow2   # Ubuntu LTS
```

**Action**: Create a new node using one of these images from the frontend UI.

### Option 2: Configure QEMU for Cisco IOS (ADVANCED)

If you specifically need to run Cisco IOS/router images, modify `backend/modules/qemuManager.js`:

#### Required Changes

1. **Detect Cisco IOS images** (in `resolveImage()` or `startVM()`):
```javascript
const isCiscoIOS = (imagePath) => {
  // Check if filename contains 'ios', 'router', 'cisco'
  return /ios|router|cisco/i.test(imagePath);
};
```

2. **Modify QEMU arguments** (in `startVM()`):
```javascript
if (isCiscoIOS(baseImagePath)) {
  // Cisco IOS requires different configuration
  const args = [
    '-vnc', `0.0.0.0:${displayNum}`,
    '-hda', node.overlayPath,
    '-m', ram.toString(),
    '-smp', cpus.toString(),
    // Cisco-specific settings
    '-machine', 'type=pc',
    '-cpu', 'qemu64',
    // Don't use -boot c for IOS
    '-nographic',           // IOS works better without graphics
    '-serial', 'mon:stdio', // Monitor + serial combined
    '-net', 'nic,model=e1000',  // Network adapter
    '-net', 'user'              // User-mode networking
  ];
  
  // Optional: Add KVM only if available
  if (fs.existsSync('/dev/kvm')) {
    args.push('-enable-kvm');
  }
} else {
  // Existing standard OS configuration
  const args = [
    '-vnc', `0.0.0.0:${displayNum}`,
    '-hda', node.overlayPath,
    '-m', ram.toString(),
    '-smp', cpus.toString(),
    '-boot', 'c',
    '-vga', 'std',
    '-serial', 'stdio'
  ];
  
  if (fs.existsSync('/dev/kvm')) {
    args.push('-enable-kvm');
  }
}
```

3. **Alternative: Use `-kernel` boot** (for some Cisco images):
```javascript
const args = [
  '-vnc', `0.0.0.0:${displayNum}`,
  '-kernel', baseImagePath,  // Boot kernel directly
  '-m', ram.toString(),
  '-smp', cpus.toString(),
  '-nographic',
  '-serial', 'mon:stdio',
  '-append', 'console=ttyS0'  // Kernel parameters
];
```

### Option 3: Use GNS3/EVE-NG Images

Cisco router images are better suited for network simulation platforms:
- **GNS3**: Dedicated network emulation
- **EVE-NG**: Enterprise virtual environment
- **Cisco VIRL/CML**: Official Cisco platform

## Testing with Working Images

### Test 1: Alpine Linux (Lightest, Fastest Boot)
```bash
# Through the UI:
1. Go to http://localhost:3000
2. Click "Create New Node"
3. Select "Alpine Linux" from base images
4. Click "Create"
5. Watch VNC and Serial Console
```

Expected output in serial console:
```
Welcome to Alpine Linux
node login:
```

### Test 2: Ubuntu 24 LTS (Full Desktop Environment)
```bash
# Through the UI:
1. Go to http://localhost:3000
2. Click "Create New Node"
3. Select "Ubuntu 24 LTS" from base images
4. Click "Create"
5. Open both Guacamole VNC and Serial Console
```

Expected:
- **VNC**: Ubuntu boot splash → login screen
- **Serial**: Kernel messages → login prompt

## Current System Status

✅ **Fixed Issues:**
- Backend now has privileged mode
- `/dev` devices accessible in container
- KVM kernel modules loaded on host (`kvm_intel`)
- Serial console WebSocket working correctly
- xterm.js terminal displaying output

❌ **Outstanding Issues:**
- Cisco IOS image won't boot with standard x86_64 OS parameters
- Need to either:
  - Use standard OS images, OR
  - Implement Cisco-specific QEMU configuration

## KVM Verification

Check if KVM is now working:
```bash
# Inside container
docker exec sandlabx-backend test -c /dev/kvm && echo "KVM Available" || echo "KVM Not Available"

# On host
ls -l /dev/kvm
# Should show: crw-rw-rw- 1 root kvm 10, 232 ...
```

## Recommendations

1. **For General VM Testing**: Use `ubuntu-24-lts.qcow2` or `debian-13.qcow2`
2. **For Quick Testing**: Use `alpine-3.qcow2` (smallest, fastest boot)
3. **For Cisco Router Simulation**: Consider using GNS3 or implement Option 2 above
4. **For Custom OS Images**: Upload proper x86_64 bootable disk images (not firmware/kernels)

## Next Steps

1. Stop current failing nodes:
```bash
curl -X POST http://localhost:3001/api/nodes/<node-id>/stop
```

2. Delete router image overlay:
```bash
rm /home/naki/Desktop/itsthatnewshit/sandboxlabs/overlays/node_*.qcow2
```

3. Create new node with Alpine/Ubuntu/Debian from the UI

4. Verify serial console shows proper boot output

## Modified Files

- ✅ `docker-compose.yml` - Added `privileged: true` and `/dev:/dev` mount
- ⚠️ `backend/modules/qemuManager.js` - Needs Cisco IOS detection (optional)

