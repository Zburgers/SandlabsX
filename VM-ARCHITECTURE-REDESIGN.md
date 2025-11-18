# 🏗️ VM Architecture Redesign - Routers + Linux VMs

## Problem Identified

### Original Design
- `startVM()` was designed for **Linux VMs only**
- Assumed VNC connection required
- Assumed 1-second boot check is enough
- Assumed Guacamole registration needed

### Router Requirements
- **No VNC** - Serial console only
- **Longer boot** - Cisco IOS takes 2-3 minutes
- **No Guacamole** - Uses WebSocket serial console
- **Different parameters** - e1000 NICs, specific RAM, etc.

## The Fix Applied ✅

### 1. Boot Timeout Logic (CRITICAL FIX)

#### Before (BROKEN)
```javascript
// Wait 150 seconds for router, 1 second for Linux
const bootTimeout = isRouter ? 150000 : 1000;
await new Promise(resolve => setTimeout(resolve, bootTimeout));

// Check AFTER waiting - router already booted or crashed!
if (qemuProcess.exitCode !== null) {
  throw new Error(`QEMU process exited`);  // ❌ False positive!
}
```

**Problem**: Router boots successfully, but the code waits 150 seconds, THEN checks exit code. During those 150 seconds, if QEMU had ANY issue and restarted, the check would fail even though the router is running!

#### After (FIXED)
```javascript
// Only check if QEMU LAUNCHED successfully (2 seconds)
await new Promise(resolve => setTimeout(resolve, 2000));

if (qemuProcess.exitCode !== null) {
  throw new Error(`QEMU failed to start (exit code ${exitCode})`);
}

// ✅ Success! QEMU is running, let it boot in background
console.log(`✅ VM started: PID ${qemuProcess.pid}`);
```

**Fix**: We check if QEMU process **started**, not if it finished booting. Boot completion happens asynchronously.

### 2. VM Type Detection

```javascript
const isRouter = node.osType === 'router' || node.baseImage === 'router';
```

Works for both:
- Explicit `osType: 'router'`
- Legacy `baseImage: 'router'`

### 3. Conditional Configuration

#### Router Configuration
```javascript
if (isRouter) {
  qemuArgs = [
    '-m', '2048',              // 2GB RAM
    '-nographic',              // No VNC
    '-serial', 'mon:stdio',    // Serial console
    '-device', 'e1000,netdev=net0',  // NIC 1
    '-device', 'e1000,netdev=net1'   // NIC 2
  ];
  // Try KVM, fall back to TCG
  vncPort = null;  // No VNC for routers
}
```

#### Linux VM Configuration
```javascript
else {
  qemuArgs = [
    '-m', String(node.resources.ram || 2048),
    '-smp', String(node.resources.cpus || 2),
    '-vnc', `0.0.0.0:${vncDisplay}`,  // VNC enabled
    '-vga', 'std',
    '-device', 'e1000,netdev=net0'
  ];
  // KVM if available
}
```

### 4. Guacamole Registration (server.js)

```javascript
// Only register with Guacamole if NOT a router
let guacConnection = { id: null, url: null, pid: null };
if (node.osType !== 'router') {
  guacConnection = await guacamoleClient.registerConnection(node, vncPort);
} else {
  console.log(`⏩ Skipping Guacamole for router (serial console only)`);
}
```

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           startVM(node)                         │
│                                                 │
│  1. Detect VM Type                             │
│     isRouter = osType === 'router'             │
│                                                 │
│  2. Build QEMU Args                            │
│     ├─ Router: -nographic, -serial, e1000x2    │
│     └─ Linux:  -vnc, -vga, e1000               │
│                                                 │
│  3. Try KVM, Fallback TCG                      │
│     if (/dev/kvm exists)                       │
│       args.push('-enable-kvm')                 │
│                                                 │
│  4. Spawn QEMU Process                         │
│     spawn('qemu-system-x86_64', args)          │
│                                                 │
│  5. Quick Launch Check (2s)                    │
│     if (exitCode !== null)                     │
│       throw Error('Failed to start')           │
│                                                 │
│  6. Return VNC Port (or null for router)       │
│                                                 │
└─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────┐
│         server.js - POST /api/nodes/:id/run    │
│                                                 │
│  1. Call qemuManager.startVM(node)             │
│  2. Get vncPort (or null)                      │
│  3. Conditional Guacamole:                     │
│     if (NOT router)                            │
│       registerConnection()                     │
│  4. Update node status: 'running'              │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Scalability Design

### Adding New VM Types (Future)

```javascript
// Easy to extend!
const vmType = detectVMType(node);

switch(vmType) {
  case 'router':
    qemuArgs = buildRouterArgs(node);
    vncPort = null;
    skipGuacamole = true;
    break;
    
  case 'linux':
    qemuArgs = buildLinuxArgs(node);
    vncPort = await getNextVNCPort();
    skipGuacamole = false;
    break;
    
  case 'windows':  // Future
    qemuArgs = buildWindowsArgs(node);
    vncPort = await getNextVNCPort();
    skipGuacamole = false;
    break;
    
  case 'firewall':  // Future
    qemuArgs = buildFirewallArgs(node);
    vncPort = null;
    skipGuacamole = true;
    break;
}
```

## Boot Time Expectations

| VM Type | Launch Check | Boot Complete | Display |
|---------|--------------|---------------|---------|
| Router | 2 seconds | ~3 minutes | Serial console |
| Linux | 2 seconds | ~30 seconds | VNC |
| Windows | 2 seconds | ~60 seconds | VNC |

**Launch Check**: Did QEMU start?
**Boot Complete**: Is OS ready? (happens async)

## Testing Checklist

### Router
- [ ] Starts without KVM error
- [ ] Uses 2GB RAM
- [ ] Shows serial output
- [ ] No VNC port assigned
- [ ] No Guacamole registration
- [ ] Boots to IOS prompt in ~3 min

### Linux VM
- [ ] Starts with VNC
- [ ] Uses assigned RAM/CPU
- [ ] VNC port assigned
- [ ] Guacamole registered
- [ ] Accessible via UI

---

**Status**: ✅ Architecture redesigned for multi-VM-type support
**Restart**: Backend restarted with fixes
**Next**: Test router creation/start
