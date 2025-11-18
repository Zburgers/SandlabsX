# SandBoxLabs Task 2 - Router Configuration Guide (For Coding Agent)

## EXECUTIVE SUMMARY FOR DEVELOPER

Your router image (router.qcow2) boots successfully but gets stuck in a **TTY Background CPU hog traceback loop**, preventing CLI access. The issue is caused by **suboptimal QEMU boot parameters** combined with Docker container resource constraints. This guide provides exact code fixes to resolve it.

**Time to fix: ~30 minutes (modify qemuManager.js with 4 parameter changes)**

---

## THE CORE PROBLEM

Current QEMU arguments for routers:
```javascript
// BROKEN - Router hangs in traceback
['-machine', 'pc', '-cpu', 'qemu64', '-m', '256', '-serial', 'mon:stdio',
 '-device', 'e1000,netdev=net0', '-netdev', 'user,id=net0', ...]
```

Why it fails:
- **`-cpu qemu64`** → Generic CPU not optimized for Docker + IOSv (causes emulation slowdown)
- **`-m 256`** → Insufficient RAM for IOSv in Docker (known bug triggers CPU hog)
- **`-serial mon:stdio`** → Monitor redirection adds buffering overhead
- **`-device/-netdev`** → Some IOSv versions need legacy `-net` syntax

---

## SOLUTION: EXACT CODE CHANGES

### Change 1: Update getRouterQemuArgs() function

Replace the existing function in `backend/modules/qemuManager.js`:

```javascript
function getRouterQemuArgs(node, platform = 'c3725') {
  // Use legacy -net syntax for better IOSv compatibility
  const args = [
    '-machine', 'pc',
    '-cpu', 'host',              // FIX 1: Use host CPU instead of qemu64
    '-m', '1024',                // FIX 2: Increase RAM to 1GB
    '-hda', node.overlayPath,
    '-nographic',
    '-serial', 'stdio',          // FIX 3: Direct serial without monitor
    '-net', 'nic,model=e1000,vlan=0,macaddr=52:54:00:12:34:56',
    '-net', 'user,vlan=0'        // FIX 4: Legacy net syntax
  ];

  // Enable KVM if available (improves performance)
  if (process.platform === 'linux') {
    try {
      const fs = require('fs');
      fs.accessSync('/dev/kvm');
      args.push('-enable-kvm');
    } catch (err) {
      // KVM not available, will use software emulation
    }
  }

  return args;
}
```

### Change 2: Ensure Docker Container has Privileged Mode

In your `docker-compose.yml`:

```yaml
backend:
  privileged: true              # REQUIRED for QEMU/KVM
  devices:
    - /dev/kvm:/dev/kvm         # Enable KVM acceleration
  environment:
    - ENABLE_KVM=true
```

### Change 3: Add Boot Wait in startVM() Method

Add this after spawning QEMU process to prevent premature timeout:

```javascript
// After: const qemuProcess = spawn(qemuCommand, args, {...})

// Store metadata for router VMs
this.runningVMs.set(node.id, {
  process: qemuProcess,
  vncPort: vncPort,
  isRouter: isRouter,
  startTime: Date.now(),
  bootWaitTime: isRouter ? 120000 : 30000  // 2 min for routers, 30s for OS
});

// Wait for boot completion
await new Promise(resolve => {
  const bootTimeout = isRouter ? 150000 : 60000; // 2.5 min for router
  setTimeout(resolve, bootTimeout);
});
```

### Change 4: Improve Serial Output Handling

Ensure serial console output is NOT suppressed:

```javascript
qemuProcess.stdout.on('data', (data) => {
  const output = data.toString();
  // Log everything - don't filter
  console.log(`[${isRouter ? 'ROUTER' : 'VM'} Serial] ${output.trim()}`);
  
  // Broadcast to WebSocket clients
  const vm = this.runningVMs.get(node.id);
  if (vm && vm.consoleClients) {
    vm.consoleClients.forEach(client => {
      try {
        client.send(output);
      } catch (e) {
        // Client disconnected
      }
    });
  }
});

// Handle stdin errors gracefully
qemuProcess.stdin.on('error', (err) => {
  console.warn(`[${node.id}] stdin error (may be normal): ${err.message}`);
});
```

---

## EXPECTED BOOT SEQUENCE (After Fixes)

When you start the router, the serial console should show:

```
[Time 0-30s]
*Mar  1 00:00:01.441: %ATA-6-DEV_FOUND: device 0x1F0
[Boot messages...]

[Time 30-60s]
*Nov 11 08:24:20.103: %LINK-3-UPDOWN: Interface GigabitEthernet0/0, changed state to up
*Nov 11 08:24:20.117: %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up
*Nov 11 08:24:21.222: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0, changed state to up

[Time 60-90s]
*Nov 11 08:25:02.172: %SYS-4-CONFIG_RESOLVE_FAILURE: [IGNORE THESE TFTP MESSAGES - NO REMOTE SERVER]
[More config parse failures...]

[Time 90-120s]
*Nov 11 08:26:56.335: %SYS-5-RESTART: System restarted --
Cisco IOS Software, IOSv Software (VIOS-ADVENTERPRISEK9-M), Version 15.6(2)T

Router>
```

**CRITICAL: Wait full 2 minutes before attempting commands!**

---

## ROUTER CONFIGURATION (Serial Console Commands)

Once you see `Router>` prompt, run these commands:

```
enable
configure terminal

interface GigabitEthernet0/0
ip address 192.168.1.1 255.255.255.0
no shutdown
exit

interface GigabitEthernet0/1
ip address 192.168.2.1 255.255.255.0
no shutdown
exit

end
write memory
show ip interface brief
```

Expected output:
```
Router# show ip interface brief

Interface                  IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0         192.168.1.1     YES manual up                    up
GigabitEthernet0/1         192.168.2.1     YES manual up                    up
```

---

## LINUX PC CONFIGURATION (PC1 and PC2)

For each Linux VM in docker-compose.yml, add boot commands:

### PC1 (192.168.1.2):
```bash
#!/bin/bash
# In Dockerfile or entrypoint script
ip addr add 192.168.1.2/24 dev eth0
ip link set eth0 up
ip route add default via 192.168.1.1
# Verify
ping -c 1 192.168.1.1
```

### PC2 (192.168.2.2):
```bash
#!/bin/bash
# In Dockerfile or entrypoint script
ip addr add 192.168.2.2/24 dev eth0
ip link set eth0 up
ip route add default via 192.168.2.1
# Verify
ping -c 1 192.168.2.1
```

---

## DOCKER-COMPOSE CONFIGURATION

Complete docker-compose.yml structure:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    privileged: true              # REQUIRED
    devices:
      - /dev/kvm:/dev/kvm         # REQUIRED for KVM
    environment:
      - ENABLE_KVM=true
    volumes:
      - /overlays:/overlays       # Must have QEMU overlays
    networks:
      - bridge
    depends_on:
      - guacamole

  router:
    image: ubuntu:latest           # Or any Linux image
    privileged: true
    networks:
      bridge:
        ipv4_address: 172.20.0.10
    cap_add:
      - NET_ADMIN

  pc1:
    image: debian:latest
    networks:
      bridge:
        ipv4_address: 172.20.1.2
    command: sleep 3600

  pc2:
    image: debian:latest
    networks:
      bridge:
        ipv4_address: 172.20.2.2
    command: sleep 3600

  guacamole:
    image: guacamole/guacamole:latest
    ports:
      - "8080:8080"
    environment:
      - GUACD_HOSTNAME=guacd

networks:
  bridge:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

## TESTING CHECKLIST

- [ ] Modify qemuManager.js with 4 changes above
- [ ] Update docker-compose.yml with `privileged: true` and `/dev/kvm`
- [ ] Restart backend container
- [ ] Start router node
- [ ] **WAIT 2 MINUTES** (do not interrupt)
- [ ] Open serial console
- [ ] Press ENTER or send 'no' if prompted
- [ ] Should see `Router>` prompt
- [ ] Type `enable` → should work
- [ ] Type `show version` → should display IOSv version
- [ ] Configure interfaces with commands above
- [ ] From PC1 serial console: `ping 192.168.2.2` (should reach PC2)
- [ ] From PC2 serial console: `ping 192.168.1.2` (should reach PC1)

---

## TROUBLESHOOTING

### Problem: Still seeing traceback loop after changes
**Solution:** 
- Verify `-cpu host` is set (check container logs)
- Ensure `-m 1024` (min 1GB RAM)
- Try `-cpu host -m 2048` (2GB) for more headroom
- Check `/dev/kvm` is available: `docker exec backend ls -la /dev/kvm`

### Problem: No output in serial console
**Solution:**
- Check WebSocket connection (browser DevTools → Console)
- Verify QEMU process is running: `docker exec backend ps aux | grep qemu`
- Check backend logs: `docker compose logs backend`

### Problem: Router boots but can't access
**Solution:**
- Press ENTER multiple times in serial console
- Send 'no' if prompted for initial config dialog
- Wait another 30 seconds, then try commands

### Problem: PC1/PC2 can't reach router
**Solution:**
- Verify IPs are configured on both PCs and router
- Check `show ip interface brief` on router
- From PC: `ip addr show` and `ip route show`
- Test router interface: `ping 192.168.1.1` from PC1

---

## TECHNICAL NOTES

**Why `-cpu host` instead of `qemu64`:**
- Host CPU has direct pass-through when KVM available
- Avoids emulation overhead in Docker
- IOSv works better with host CPU semantics

**Why 1024MB RAM:**
- IOSv has CPU hog bug with <512MB in Docker
- 1GB is safe minimum for IOSv in containers
- Standard VMs still work with 256-512MB

**Why `-serial stdio` instead of `-serial mon:stdio`:**
- Direct redirection to stdout/stdin
- No QEMU monitor overhead
- Cleaner serial console output

**Why legacy `-net` syntax:**
- Some IOSv versions don't fully support modern `-device/-netdev`
- Legacy syntax more compatible with various IOS versions
- Still creates full GigabitEthernet interfaces

---

## SUMMARY FOR DEVELOPER

Make these 4 changes to `qemuManager.js`:

1. Change `-cpu qemu64` → `-cpu host`
2. Change `-m 256` → `-m 1024`
3. Change `-serial mon:stdio` → `-serial stdio`
4. Change `-device/-netdev pairs` → `-net nic,model=e1000` + `-net user`

Plus ensure Docker has:
- `privileged: true`
- `/dev/kvm` access

That's it. Router will boot and be configurable within 2 minutes.
