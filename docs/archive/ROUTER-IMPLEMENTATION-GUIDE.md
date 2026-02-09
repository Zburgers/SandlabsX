# Cisco Router Support Implementation Guide

## Architecture Overview

### Data Flow for Router Console Access

```
┌─────────────────┐
│   Browser UI    │
│   (xterm.js)    │
└────────┬────────┘
         │ WebSocket (ws://backend:3001/ws/console?nodeId=XXX)
         │
         ▼
┌─────────────────┐
│  Backend API    │
│  (Express.js)   │
└────────┬────────┘
         │ Process Pipes (stdin/stdout)
         │
         ▼
┌─────────────────┐
│  QEMU Process   │
│  -serial stdio  │
└────────┬────────┘
         │ Virtual Serial Port
         │
         ▼
┌─────────────────┐
│  Cisco IOS VM   │
│  Console Port   │
└─────────────────┘
```

### Why VNC Shows Nothing for Routers

**Physical Cisco Router:**
```
[Router Hardware]
    ├── Console Port (RJ45) ──→ Serial Cable ──→ Terminal
    ├── Network Ports (GE0/0, GE0/1, etc.)
    └── NO VIDEO OUTPUT (no monitor connector!)
```

**Our QEMU Emulation:**
```
[QEMU Router VM]
    ├── -serial stdio ──→ WebSocket ──→ xterm.js Console ✅
    ├── -vnc 0.0.0.0:X ──→ Guacamole ──→ Blank/BIOS screen ❌
    └── -net nic,model=e1000 ──→ Virtual network interfaces
```

## Code Implementation

### Step 1: Add Router Detection

```javascript
// backend/modules/qemuManager.js

/**
 * Detect if an image is a Cisco router/IOS image
 * @param {string} imagePath - Path to the image file
 * @param {string} imageName - Original filename
 * @returns {boolean}
 */
function isRouterImage(imagePath, imageName = '') {
  const nameIndicators = /ios|router|cisco|dynamips|c[0-9]{4}|c[0-9]{1}[kx]/i;
  const pathIndicators = /router|cisco|ios/i;
  
  // Check filename
  if (nameIndicators.test(imageName)) return true;
  
  // Check path
  if (pathIndicators.test(imagePath)) return true;
  
  // Could also check file size (Cisco IOS typically 50-300 MB)
  // or magic bytes, but filename detection is usually sufficient
  
  return false;
}

/**
 * Detect router platform from image name
 * @param {string} imageName 
 * @returns {string} - Platform identifier (c3725, c7200, etc.)
 */
function detectRouterPlatform(imageName) {
  // Common Cisco router platforms
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
  
  return 'c3725'; // Default to 3725 (common mid-range router)
}
```

### Step 2: Router-Specific QEMU Configuration

```javascript
/**
 * Get QEMU args for Cisco router emulation
 * @param {Object} node - Node configuration
 * @param {string} platform - Router platform (c3725, c7200, etc.)
 * @returns {Array<string>} - QEMU arguments
 */
function getRouterQemuArgs(node, platform = 'c3725') {
  const displayNum = node.vncPort - 5900;
  
  // Platform-specific configurations
  const platformConfigs = {
    c7200: {
      machine: 'pc',
      cpu: 'qemu64',
      ram: 512,  // 7200 needs more RAM
      nics: 4,   // 4 FastEthernet interfaces
      nicModel: 'e1000'
    },
    c3725: {
      machine: 'pc',
      cpu: 'qemu64',
      ram: 256,
      nics: 2,   // 2 GigabitEthernet interfaces
      nicModel: 'e1000'
    },
    c2691: {
      machine: 'pc',
      cpu: 'qemu64',
      ram: 192,
      nics: 2,
      nicModel: 'e1000'
    }
  };
  
  const config = platformConfigs[platform] || platformConfigs.c3725;
  const ram = node.resources?.ram || config.ram;
  
  const args = [
    // Machine type
    '-machine', config.machine,
    '-cpu', config.cpu,
    
    // Memory
    '-m', ram.toString(),
    
    // Boot disk
    '-hda', node.overlayPath,
    
    // NO GRAPHICS - routers are headless
    '-nographic',
    
    // Serial console (primary interface)
    '-serial', 'mon:stdio',
    
    // Still provide VNC for compatibility (will show BIOS/blank)
    '-vnc', `0.0.0.0:${displayNum}`,
    
    // Network interfaces
    // Note: These will be GigabitEthernet0/0, GigabitEthernet0/1, etc. in IOS
  ];
  
  // Add network interfaces
  for (let i = 0; i < config.nics; i++) {
    args.push(
      '-device', `${config.nicModel},netdev=net${i}`,
      '-netdev', `user,id=net${i}`
    );
  }
  
  // KVM acceleration (if available)
  // Note: Some IOS versions work better with TCG (software emulation)
  try {
    if (fs.existsSync('/dev/kvm')) {
      args.push('-enable-kvm');
    }
  } catch (err) {
    // KVM not available, use software emulation
  }
  
  return args;
}
```

### Step 3: Modify startVM() Method

```javascript
// In QemuManager.startVM() method

async startVM(node) {
  console.log(`🚀 Starting VM for node ${node.id.substring(0, 8)}...`);

  // Ensure overlay exists
  await this.createOverlay(node);

  const displayNum = node.vncPort - 5900;
  const ram = node.resources?.ram || parseInt(process.env.QEMU_RAM) || 2048;
  const cpus = node.resources?.cpus || parseInt(process.env.QEMU_CPUS) || 2;

  // Determine if this is a router image
  const imageInfo = node.image || {};
  const imageName = imageInfo.name || imageInfo.id || '';
  const imagePath = imageInfo.path || node.overlayPath;
  const isRouter = isRouterImage(imagePath, imageName);

  let args;
  let qemuCommand = 'qemu-system-x86_64';

  if (isRouter) {
    // CISCO ROUTER CONFIGURATION
    console.log(`  📡 Detected Cisco router image: ${imageName}`);
    const platform = detectRouterPlatform(imageName);
    console.log(`  🔧 Using platform configuration: ${platform}`);
    
    args = getRouterQemuArgs(node, platform);
    
    console.log(`  ⚠️  Router mode: Serial console is primary interface`);
    console.log(`  ⚠️  VNC will show BIOS/blank screen - use Serial Console!`);
    
  } else {
    // STANDARD OS CONFIGURATION (existing code)
    console.log(`  💻 Standard OS image detected`);
    
    args = [
      '-vnc', `0.0.0.0:${displayNum}`,
      '-hda', node.overlayPath,
      '-m', ram.toString(),
      '-smp', cpus.toString(),
      '-boot', 'c',
      '-name', `node_${node.id}`,
      '-vga', 'std',
      '-serial', 'stdio'
    ];

    // Check for KVM
    try {
      await fs.access('/dev/kvm');
      args.push('-enable-kvm');
      console.log(`  ⚡ Using KVM acceleration`);
    } catch (err) {
      console.log(`  ⚠️  KVM not available, using software emulation`);
    }
  }

  console.log(`  VNC Port: ${node.vncPort} (display :${displayNum})`);
  console.log(`  Command: ${qemuCommand} ${args.join(' ')}`);
  console.log(`  Overlay: ${node.overlayPath}`);

  // Spawn QEMU process
  const qemuProcess = spawn(qemuCommand, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  });

  // Store process
  this.processes[node.id] = {
    process: qemuProcess,
    vncPort: node.vncPort,
    startedAt: new Date(),
    isRouter: isRouter,
    platform: isRouter ? detectRouterPlatform(imageName) : null
  };

  // Handle QEMU output
  qemuProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[QEMU ${node.id.substring(0, 8)}] ${output.trim()}`);
  });

  qemuProcess.stderr.on('data', (data) => {
    console.error(`[QEMU ERR ${node.id.substring(0, 8)}] ${data.toString().trim()}`);
  });

  qemuProcess.on('exit', (code, signal) => {
    console.log(`❌ QEMU process for node ${node.id.substring(0, 8)} exited (code: ${code}, signal: ${signal})`);
    delete this.processes[node.id];
  });

  console.log(`✅ VM started: PID ${qemuProcess.pid}, VNC :${displayNum} (${node.vncPort})`);
  
  if (isRouter) {
    console.log(`  📟 Access router console via Serial Console in UI`);
  }

  return {
    pid: qemuProcess.pid,
    vncPort: node.vncPort,
    isRouter: isRouter
  };
}
```

### Step 4: Frontend UI Indicators

```typescript
// frontend/components/NodeCard.tsx
// Add router indicator

{node.image?.type === 'custom' && node.image?.name?.match(/router|ios|cisco/i) && (
  <div className="mt-2 flex items-center gap-2 text-yellow-600 text-sm">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
    <span>Router Image - Use Serial Console</span>
  </div>
)}
```

## Expected Serial Console Output

### Successful Cisco Router Boot:

```
System Bootstrap, Version 12.4(24)T
Copyright (c) 1986-2009 by cisco Systems, Inc.

platform with 262144 Kbytes of main memory

program load complete, entry point: 0x8000f000, size: 0xcb80

Self decompressing the image : ##################################################
##################################################
##################################################

              Restricted Rights Legend

Use, duplication, or disclosure by the Government is
subject to restrictions as set forth in subparagraph
(c) of the Commercial Computer Software - Restricted
Rights clause at FAR sec. 52.227-19 and subparagraph
(c) (1) (ii) of the Rights in Technical Data and Computer
Software clause at DFARS sec. 252.227-7013.

           cisco Systems, Inc.
           170 West Tasman Drive
           San Jose, California 95134-1706


Cisco IOS Software, 3700 Software (C3725-ADVENTERPRISEK9-M), Version 12.4(15)T14
[Boot messages continue...]

Router>
```

### Commands You Can Run:

```
Router> enable
Password: [if configured]

Router# show version
Router# show ip interface brief
Router# configure terminal
Router(config)# hostname MyRouter
MyRouter(config)# interface GigabitEthernet0/0
MyRouter(config-if)# ip address 192.168.1.1 255.255.255.0
MyRouter(config-if)# no shutdown
MyRouter(config-if)# exit
MyRouter(config)# exit
MyRouter# show running-config
```

## Testing Checklist

### Test 1: Standard OS (Verify Nothing Broke)
- [ ] Create Ubuntu node
- [ ] Check VNC shows boot screen
- [ ] Check serial console shows kernel messages
- [ ] Verify both interfaces work

### Test 2: Router Image
- [ ] Upload router.qcow2 as custom image
- [ ] Create node with router image
- [ ] **Ignore VNC** (will be blank/BIOS)
- [ ] Open Serial Console
- [ ] Wait for `Router>` prompt (may take 30-60 seconds)
- [ ] Type `enable` and press Enter
- [ ] Type `show version`
- [ ] Verify IOS responds with version info

### Test 3: Multiple Routers
- [ ] Create 2-3 router nodes
- [ ] Each should have own console
- [ ] Each should boot independently
- [ ] Verify no port conflicts

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

### Router Shows Nothing

**Check:**
1. Is serial console connected? (WebSocket status)
2. Is QEMU process running? (`docker exec sandlabx-backend ps aux | grep qemu`)
3. Check backend logs: `docker compose logs backend | grep QEMU`

### Wrong Platform Detection

**Manual Override:**
Add to node creation:
```javascript
{
  ...nodeData,
  platform: 'c7200'  // Force specific platform
}
```

## Performance Considerations

### Router vs OS Resource Usage

| Type | RAM | CPU | Boot Time | KVM Benefit |
|------|-----|-----|-----------|-------------|
| Ubuntu Desktop | 2 GB | 2 cores | 30-60s | High (5-10x faster) |
| Alpine Linux | 512 MB | 1 core | 5-10s | Medium (2-3x faster) |
| Cisco Router | 256 MB | 1 core | 20-40s | Low (IOS is single-threaded) |

**Recommendation:** 
- Use KVM for all if available
- Routers work fine with software emulation if needed
- Multiple router instances: Keep RAM at 256-512 MB each

## Next Steps

1. **Implement detection functions** (isRouterImage, detectRouterPlatform)
2. **Modify startVM()** to use router args when detected
3. **Test with your router.qcow2** image
4. **Document router-specific workflows** in UI
5. **Add platform selector** in CreateNodeModal for advanced users

