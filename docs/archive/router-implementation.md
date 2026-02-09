# Cisco Router Support Implementation Guide for SandBoxLabs

## Executive Summary

Your existing serial console infrastructure is **perfectly designed** for Cisco routers. The WebSocket → xterm.js pipeline you've already built mirrors exactly how network engineers interact with physical routers via console cables. You just need to modify the QEMU launch parameters to boot router images correctly.

## Understanding the Architecture

### Why VNC Shows Nothing for Routers

**Physical Cisco Router:**
```
[Router Hardware]
    ├── Console Port (RJ45) ──→ Serial Cable ──→ PC Terminal
    ├── Network Ports (GE0/0, GE0/1, etc.)
    └── NO VIDEO OUTPUT (no monitor connector exists!)
```

Real Cisco routers have **zero graphical output**. No VGA, no HDMI, nothing. Network admins configure them via a serial console cable plugged into an RJ45 port.

**Your QEMU Implementation:**
```
[QEMU Router VM]
    ├── -serial stdio ──→ WebSocket ──→ xterm.js Console ✅ WORKS
    ├── -vnc 0.0.0.0:X ──→ Guacamole ──→ Blank/BIOS screen ❌ EXPECTED
    └── -device e1000 ──→ Virtual GigabitEthernet interfaces
```

Your serial console is the **primary and only** interface for routers. VNC being blank is correct behavior!

---

## Task 2 Requirements Analysis

### Network Topology Needed
```
PC1 (192.168.1.2) ──┐
                     ├── Router ── GigabitEthernet0/0 (192.168.1.1)
PC2 (192.168.2.2) ──┤
                     └── Router ── GigabitEthernet0/1 (192.168.2.1)
```

### QEMU Configuration Required
- **2 network interfaces** = 2x `-device e1000`
- Each e1000 device appears as GigabitEthernet in IOS
- Interfaces numbered sequentially: Gi0/0, Gi0/1, Gi0/2...

---

## Complete QEMU Command for Task 2

```bash
qemu-system-x86_64 \
  -machine pc \
  -cpu qemu64 \
  -m 256 \
  -hda /overlays/router-node-XXX.qcow2 \
  -nographic \
  -serial mon:stdio \
  -device e1000,netdev=net0 \
  -netdev user,id=net0 \
  -device e1000,netdev=net1 \
  -netdev user,id=net1
```

### Parameter Breakdown

| Parameter | Purpose |
|-----------|---------|
| `-machine pc` | Standard PC machine type (works for IOS) |
| `-cpu qemu64` | Generic x86-64 CPU (IOS compatible) |
| `-m 256` | 256MB RAM (sufficient for c3725 router) |
| `-hda <overlay>` | Boot disk containing IOS image |
| `-nographic` | **Critical**: No graphics output |
| `-serial mon:stdio` | **Critical**: Serial console on stdout/stdin |
| `-device e1000,netdev=net0` | Creates GigabitEthernet0/0 |
| `-netdev user,id=net0` | User-mode network backend for Gi0/0 |
| `-device e1000,netdev=net1` | Creates GigabitEthernet0/1 |
| `-netdev user,id=net1` | User-mode network backend for Gi0/1 |

---

## Code Implementation

### Step 1: Add Router Detection Function

Add to `backend/modules/qemuManager.js` (before the `QemuManager` class):

```javascript
/**
 * Detect if an image is a Cisco router/IOS image
 * @param {string} imagePath - Path to the image file
 * @param {string} imageName - Original filename
 * @returns {boolean}
 */
function isRouterImage(imagePath, imageName = '') {
  // Check filename patterns
  const routerPatterns = /ios|router|cisco|c[0-9]{4}|c[0-9]{1}[kx]/i;
  
  if (routerPatterns.test(imageName)) return true;
  if (routerPatterns.test(imagePath)) return true;
  
  return false;
}

/**
 * Detect router platform from image name
 * @param {string} imageName 
 * @returns {string} Platform identifier
 */
function detectRouterPlatform(imageName) {
  const platforms = {
    'c7200': /c7200/i,
    'c3725': /c3725/i,
    'c3745': /c3745/i,
    'c2691': /c2691/i,
    'c2600': /c2[56]00/i,
    'c1700': /c1[78]00/i,
  };
  
  for (const [platform, regex] of Object.entries(platforms)) {
    if (regex.test(imageName)) return platform;
  }
  
  return 'c3725'; // Default to 3725
}
```

### Step 2: Add Router QEMU Args Function

```javascript
/**
 * Get QEMU arguments for Cisco router emulation
 * @param {Object} node - Node configuration
 * @param {string} platform - Router platform
 * @returns {Array<string>} QEMU arguments
 */
function getRouterQemuArgs(node, platform = 'c3725') {
  // Platform configurations
  const platformConfigs = {
    c7200: { ram: 512, nics: 2 },
    c3725: { ram: 256, nics: 2 },
    c2691: { ram: 192, nics: 2 }
  };
  
  const config = platformConfigs[platform] || platformConfigs.c3725;
  const ram = node.resources?.ram || config.ram;
  
  const args = [
    // Machine and CPU
    '-machine', 'pc',
    '-cpu', 'qemu64',
    
    // Memory
    '-m', ram.toString(),
    
    // Boot disk
    '-hda', node.overlayPath,
    
    // NO GRAPHICS - routers are headless
    '-nographic',
    
    // Serial console as primary interface
    '-serial', 'mon:stdio'
  ];
  
  // Add network interfaces (creates GigabitEthernet in IOS)
  for (let i = 0; i < config.nics; i++) {
    args.push(
      '-device', `e1000,netdev=net${i}`,
      '-netdev', `user,id=net${i}`
    );
  }
  
  // Optional: KVM acceleration if available
  if (process.platform === 'linux') {
    try {
      const fs = require('fs');
      fs.accessSync('/dev/kvm');
      args.push('-enable-kvm');
    } catch (err) {
      // KVM not available, use TCG (software emulation)
    }
  }
  
  return args;
}
```

### Step 3: Modify startVM() Method

Find the `async startVM(node)` method in `qemuManager.js` and modify it:

```javascript
async startVM(node) {
  console.log(`🚀 Starting VM for node ${node.id.substring(0, 8)}...`);

  // Ensure overlay exists
  await this.createOverlay(node);

  const vncPort = node.vncPort || await this.getNextAvailablePort();
  const vncDisplay = vncPort - 5900;
  
  // Determine if this is a router image
  const imageInfo = node.image || {};
  const imageName = imageInfo.name || imageInfo.id || '';
  const imagePath = imageInfo.path || node.overlayPath;
  const isRouter = isRouterImage(imagePath, imageName);

  let args;
  let qemuCommand = 'qemu-system-x86_64';

  if (isRouter) {
    // ========== CISCO ROUTER CONFIGURATION ==========
    console.log(`  📡 Detected Cisco router image: ${imageName}`);
    const platform = detectRouterPlatform(imageName);
    console.log(`  🔧 Platform: ${platform}`);
    
    args = getRouterQemuArgs(node, platform);
    
    console.log(`  ⚠️  Router mode: Serial console is PRIMARY interface`);
    console.log(`  ⚠️  VNC will show blank screen - use Serial Console!`);
    
  } else {
    // ========== STANDARD OS CONFIGURATION ==========
    console.log(`  💻 Standard OS image detected`);
    
    const ram = node.resources?.ram || 2048;
    const cpus = node.resources?.cpus || 2;
    
    args = [
      '-vnc', `0.0.0.0:${vncDisplay}`,
      '-hda', node.overlayPath,
      '-m', ram.toString(),
      '-smp', cpus.toString(),
      '-boot', 'c',
      '-name', `node_${node.id}`,
      '-vga', 'std',
      '-serial', 'stdio'
    ];

    // KVM for standard OS
    if (process.platform === 'linux') {
      try {
        await fs.access('/dev/kvm');
        args.push('-enable-kvm');
        console.log(`  ⚡ KVM acceleration enabled`);
      } catch (err) {
        console.log(`  ⚠️  KVM not available`);
      }
    }
  }

  console.log(`  VNC: ${vncPort} (display :${vncDisplay})`);
  console.log(`  Command: ${qemuCommand} ${args.join(' ')}`);

  // Spawn QEMU process
  const qemuProcess = spawn(qemuCommand, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  });

  // Store process with router flag
  this.runningVMs.set(node.id, {
    process: qemuProcess,
    vncPort: vncPort,
    startTime: Date.now(),
    consoleClients: new Set(),
    isRouter: isRouter,
    platform: isRouter ? detectRouterPlatform(imageName) : null
  });

  // [Rest of your existing event handlers...]
  qemuProcess.stdout.on('data', (data) => {
    console.log(`[QEMU ${node.id.substring(0, 8)}] ${data.toString().trim()}`);
  });

  qemuProcess.stderr.on('data', (data) => {
    console.error(`[QEMU ERR ${node.id.substring(0, 8)}] ${data.toString().trim()}`);
  });

  qemuProcess.on('exit', (code, signal) => {
    console.log(`❌ QEMU exited: ${node.id.substring(0, 8)} (code: ${code})`);
    this.runningVMs.delete(node.id);
  });

  // Wait for VM to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (qemuProcess.exitCode !== null) {
    throw new Error(`QEMU exited immediately with code ${qemuProcess.exitCode}`);
  }

  console.log(`✅ VM started: PID ${qemuProcess.pid}`);
  
  if (isRouter) {
    console.log(`  📟 Access via Serial Console in UI (VNC will be blank)`);
  }

  return { pid: qemuProcess.pid, vncPort: vncPort, isRouter: isRouter };
}
```

---

## Router Configuration Commands (Post-Boot)

After the router boots in your serial console, you'll see:

```
Router>
```

Enter these commands:

```
Router> enable
Router# configure terminal
Router(config)# interface GigabitEthernet0/0
Router(config-if)# ip address 192.168.1.1 255.255.255.0
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# interface GigabitEthernet0/1
Router(config-if)# ip address 192.168.2.1 255.255.255.0
Router(config-if)# no shutdown
Router(config-if)# end
Router# write memory
```

Verify:
```
Router# show ip interface brief
Router# show running-config
```

---

## Expected Serial Console Output

### Boot Sequence (30-60 seconds):

```
System Bootstrap, Version 12.4(24)T
Copyright (c) 1986-2009 by cisco Systems, Inc.

platform with 262144 Kbytes of main memory

Self decompressing the image : ##############################
##############################

Cisco IOS Software, 3700 Software (C3725-ADVENTERPRISEK9-M)
Version 12.4(15)T14

Router>
```

### After Configuration:

```
Router# show ip interface brief

Interface                  IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0         192.168.1.1     YES manual up                    up
GigabitEthernet0/1         192.168.2.1     YES manual up                    up
```

---

## Testing Checklist

### Before Implementation:
- [ ] Backup `qemuManager.js`
- [ ] Ensure router.qcow2 is uploaded to custom images
- [ ] Verify serial console WebSocket is working

### After Implementation:
- [ ] Create router node via UI
- [ ] Start router node
- [ ] **Ignore VNC** (will be blank - EXPECTED)
- [ ] Open Serial Console
- [ ] Wait for `Router>` prompt (30-60 sec)
- [ ] Type `enable` → Should see `Router#`
- [ ] Type `show version` → Should see IOS details
- [ ] Type `show ip interface brief` → Should see Gi0/0 and Gi0/1
- [ ] Configure interfaces with IPs
- [ ] Verify `no shutdown` brings them up

---

## Troubleshooting

### Router Stuck at ROMMON

**Symptom:**
```
rommon 1 >
```

**Solution:**
```
rommon 1 > boot flash:c3725-adventerprisek9-mz.124-15.T14.bin
```

### Router Shows Nothing in Serial Console

**Check:**
1. Is WebSocket connected? (Check browser console)
2. Is QEMU process running? `docker exec sandlabx-backend ps aux | grep qemu`
3. Check logs: `docker compose logs backend | grep QEMU`

### Network Interfaces Not Showing

**Verify:**
- Each `-device e1000` has matching `-netdev`
- IDs are unique: net0, net1, net2...
- Router has booted fully (can take 60+ seconds)

---

## Key Differences: Router vs OS

| Aspect | Standard OS VM | Cisco Router |
|--------|---------------|--------------|
| **Primary Interface** | VNC/Guacamole | Serial Console |
| **Graphics** | Yes (-vga std) | No (-nographic) |
| **Boot Time** | 30-60 sec | 30-60 sec |
| **RAM** | 2048+ MB | 256-512 MB |
| **Network Model** | virtio-net | e1000 |
| **Network Names** | eth0, eth1 | Gi0/0, Gi0/1 |
| **VNC Output** | Desktop/TTY | Blank/BIOS only |
| **Configuration** | SSH, GUI | IOS CLI via serial |

---

## Why Your Architecture is Perfect

You've already built **exactly** what Cisco routers need:

✅ **Serial console via WebSocket** - This is how real routers are managed  
✅ **xterm.js terminal** - Perfect for IOS CLI  
✅ **Bidirectional I/O** - Supports full IOS interaction  
✅ **QEMU process management** - Just need different args  

The only change needed is recognizing router images and launching them with `-nographic -serial mon:stdio` instead of `-boot c -vga std`.

---

## Next Steps

1. **Add the 3 functions** to `qemuManager.js`
2. **Modify `startVM()`** to use router detection
3. **Test with router.qcow2**
4. **Configure router via Serial Console**
5. **Verify both interfaces appear**

Your serial console infrastructure is production-ready for routers. Just flip the switch! 🎯
