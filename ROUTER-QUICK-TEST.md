# Quick Router Test Guide

## Current System Status

✅ **All fixes implemented and deployed**
- Backend container rebuilt with router fixes
- QEMU args updated: `-cpu host -m 1024 -serial stdio`
- Legacy network syntax enabled for IOSv compatibility
- Boot timeout extended to 150 seconds
- Serial console streaming improved

## Quick Test (3 Steps)

### Step 1: Create Router Node via API

```bash
curl -X POST http://localhost:3001/api/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestRouter",
    "osType": "router",
    "resources": {
      "ram": 1024,
      "cpus": 1
    }
  }'
```

Save the returned node `id` (e.g., `12345678-1234-1234-1234-123456789012`)

### Step 2: Start the Router

```bash
# Replace NODE_ID with actual ID from step 1
curl -X POST http://localhost:3001/api/nodes/NODE_ID/run
```

**Important:** Wait 2-3 minutes for router to fully boot. Do NOT restart or interrupt.

### Step 3: Check Router Status

```bash
# Check backend logs for router boot messages
docker compose logs -f backend | grep -E "(ROUTER|Serial|Cisco)"
```

Expected output after ~2 minutes:
```
[ROUTER Serial 12345678] Cisco IOS Software, IOSv Software
[ROUTER Serial 12345678] Router>
```

## Access Router Console

### Via UI (Recommended)
1. Open http://localhost:3000
2. Find "TestRouter" node
3. Click "Serial Console" tab
4. Wait for `Router>` prompt (~2 minutes)
5. Type commands: `enable`, `show version`, etc.

### Via WebSocket (Advanced)
```javascript
const ws = new WebSocket('ws://localhost:3001/console/NODE_ID');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send('enable\n');
```

## Test Router Commands

Once you see `Router>` prompt:

```cisco
enable
show version
show ip interface brief
```

Expected interfaces:
```
Interface                  IP-Address      OK? Method Status    Protocol
GigabitEthernet0/0         unassigned      YES unset  up        up
GigabitEthernet0/1         unassigned      YES unset  up        up
```

## Configure Router

```cisco
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
```

## Verify Configuration

```cisco
show running-config interface GigabitEthernet0/0
show running-config interface GigabitEthernet0/1
ping 192.168.1.1
ping 192.168.2.1
```

## Monitor Backend Logs

```bash
# Watch for router boot sequence
docker compose logs -f backend

# Look for these messages:
# ✅ VM started: PID 12345
# ⏱️  Router boot time: ~120 seconds - please wait!
# [ROUTER Serial] %LINK-3-UPDOWN: Interface GigabitEthernet0/0, changed state to up
# [ROUTER Serial] Router>
```

## Troubleshooting

### Router not booting?
```bash
# Check QEMU process
docker exec sandlabx-backend ps aux | grep qemu

# Should show: -cpu host -m 1024 -serial stdio
```

### No serial output?
```bash
# Restart backend container
docker compose restart backend

# Wait 30 seconds, try starting router again
```

### Still having issues?
```bash
# Check full backend logs
docker compose logs backend --tail 100

# Verify router image exists
docker exec sandlabx-backend ls -lh /images/router.qcow2
```

## Success Criteria

✅ Router boots in 90-120 seconds (no traceback loop)  
✅ Serial console shows Cisco IOS messages  
✅ `Router>` prompt appears  
✅ `enable` command works  
✅ `show version` displays IOSv version  
✅ Both GigabitEthernet interfaces are "up"  
✅ Interfaces can be configured with IP addresses  

## Performance Expectations

### With KVM (bare metal)
- Boot time: 90-120 seconds
- CPU: 10-20% after boot
- RAM: ~512MB

### Without KVM (nested VM)
- Boot time: 120-180 seconds
- CPU: 30-50% during boot, stable after
- RAM: ~512MB

**Note:** This system doesn't have KVM, so expect slower boot times.

## Next Steps After Router Works

1. Create PC1 node (Ubuntu/Debian)
2. Create PC2 node (Ubuntu/Debian)
3. Configure PC1: 192.168.1.2/24, gateway 192.168.1.1
4. Configure PC2: 192.168.2.2/24, gateway 192.168.2.1
5. Test: `ping 192.168.2.2` from PC1

---

**Last Updated:** November 11, 2025  
**Status:** Implementation Complete ✅
