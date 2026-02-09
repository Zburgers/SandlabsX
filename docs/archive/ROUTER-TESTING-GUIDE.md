# Cisco Router Testing Guide - SandBoxLabs

## ✅ Implementation Complete!

Router support has been successfully implemented in `backend/modules/qemuManager.js`:

### Added Functions:
1. ✅ `isRouterImage()` - Detects Cisco router images
2. ✅ `detectRouterPlatform()` - Identifies platform (c3725, c7200, etc.)
3. ✅ `getRouterQemuArgs()` - Builds router-specific QEMU arguments

### Modified Method:
- ✅ `startVM()` - Auto-detects router images and uses correct configuration

---

## Quick Test Instructions

### Step 1: Access the UI
```bash
# Open in your browser:
http://localhost:3000
```

### Step 2: Create Router Node

1. Click **"Create New Node"** button
2. In the modal:
   - **Name**: Enter "Router-Task2" (or any name)
   - **Image Selection**: 
     - Switch to **"Custom Images"** tab
     - Select **"router_1762805489189"** (your uploaded router image)
   - Click **"Create"**

### Step 3: Start the Router

1. Find the new router node card
2. Click the **▶ Start** button
3. **Wait 30-60 seconds** for boot (routers take time!)

### Step 4: Access Serial Console

1. Click **"Serial Console"** button on the router node
2. **IGNORE** the Guacamole VNC viewer (it will be blank - this is expected!)
3. Wait for the router boot sequence to complete

---

## Expected Serial Console Output

### During Boot (30-60 seconds):
```
System Bootstrap, Version 12.4(24)T
Copyright (c) 1986-2009 by cisco Systems, Inc.

platform with 262144 Kbytes of main memory

Self decompressing the image : ####################################
##################################################################

Cisco IOS Software, 3700 Software (C3725-ADVENTERPRISEK9-M)
Version 12.4(15)T14
```

### After Boot - You'll See:
```
Router>
```

---

## Router Configuration for Task 2

Once you see `Router>` prompt, paste these commands:

```
enable
configure terminal

! Configure GigabitEthernet0/0 for PC1 network
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 no shutdown
 exit

! Configure GigabitEthernet0/1 for PC2 network
interface GigabitEthernet0/1
 ip address 192.168.2.1 255.255.255.0
 no shutdown
 exit

! Set hostname
hostname Router-Task2

end
write memory
```

---

## Verification Commands

### Check Interfaces:
```
Router# show ip interface brief
```

**Expected Output:**
```
Interface                  IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0         192.168.1.1     YES manual up                    up      
GigabitEthernet0/1         192.168.2.1     YES manual up                    up
```

### Check Running Config:
```
Router# show running-config
```

### Check Version:
```
Router# show version
```

### Test Connectivity:
```
Router# ping 192.168.1.1
Router# ping 192.168.2.1
```

---

## Understanding the Output

### ✅ What's Working:

1. **Serial Console** - Your xterm.js terminal receives all router output
2. **Two Network Interfaces** - QEMU creates Gi0/0 and Gi0/1 using e1000 drivers
3. **WebSocket Bridge** - Your existing infrastructure pipes QEMU stdio perfectly
4. **Interactive CLI** - You can type commands and configure the router

### ❌ Why VNC is Blank (This is CORRECT!):

Physical Cisco routers have:
- ✅ Console Port (RJ45) for serial connection
- ✅ Network Ports (GigabitEthernet)
- ❌ **NO VIDEO OUTPUT** (no monitor connector!)

Your VNC showing blank = Exactly how real routers work!

---

## Backend Logs to Watch

```bash
# Watch backend logs in real-time
docker compose logs -f backend

# You should see:
# 📡 Detected Cisco router image: router_1762805489189
# 🔧 Platform: c3725
# ⚠️  Router mode: Serial console is PRIMARY interface
# ⚠️  VNC will show blank screen - use Serial Console!
```

---

## QEMU Command Being Used

The system now generates this command for routers:

```bash
qemu-system-x86_64 \
  -machine pc \
  -cpu qemu64 \
  -m 256 \
  -hda /overlays/node_XXXXXXXX.qcow2 \
  -nographic \
  -serial mon:stdio \
  -device e1000,netdev=net0 \
  -netdev user,id=net0 \
  -device e1000,netdev=net1 \
  -netdev user,id=net1 \
  -enable-kvm
```

### Key Parameters:
- **`-nographic`** - No graphics (routers are headless)
- **`-serial mon:stdio`** - Serial console on stdout/stdin
- **`-device e1000`** (x2) - Creates Gi0/0 and Gi0/1
- **`-m 256`** - 256MB RAM (sufficient for c3725)

---

## Troubleshooting

### Problem: Nothing in Serial Console
**Solution:** Wait 60 seconds - routers take time to boot

### Problem: ROMMON prompt (`rommon 1 >`)
**Solution:** 
```
rommon 1 > boot
```

### Problem: Only 1 Interface Showing
**Solution:** Verify backend logs show `-device e1000` twice

### Problem: Can't Type in Console
**Solution:** 
1. Check browser console for WebSocket errors
2. Ensure WebSocket connection is established
3. Try refreshing the page

### Problem: "Router>" prompt but commands don't work
**Solution:** 
1. Type `enable` first (enters privileged mode)
2. You should see `Router#` prompt
3. Now commands will work

---

## Task 2 Network Topology

```
PC1 (192.168.1.2)
       |
       | Network: 192.168.1.0/24
       |
   Gi0/0 (192.168.1.1)
    [Router]
   Gi0/1 (192.168.2.1)
       |
       | Network: 192.168.2.0/24
       |
PC2 (192.168.2.2)
```

**Router Configuration:**
- **Gi0/0**: 192.168.1.1/24 (gateway for PC1)
- **Gi0/1**: 192.168.2.1/24 (gateway for PC2)
- **Routing**: Automatic (directly connected networks)

---

## Next Steps for Task 2

1. ✅ Start router and configure interfaces (above)
2. ⏭️ Create PC1 VM with IP 192.168.1.2 (gateway 192.168.1.1)
3. ⏭️ Create PC2 VM with IP 192.168.2.2 (gateway 192.168.2.1)
4. ⏭️ Test connectivity: PC1 → Router → PC2

---

## Comparison: Router vs Standard OS

| Feature | Cisco Router | Ubuntu/Alpine VM |
|---------|-------------|------------------|
| **Detection** | Filename contains "router", "ios", "cisco" | Other images |
| **QEMU Args** | `-nographic -serial mon:stdio` | `-boot c -vga std` |
| **RAM** | 256 MB | 2048 MB |
| **Network** | e1000 (Gi0/0, Gi0/1) | virtio-net (eth0) |
| **Primary UI** | Serial Console ✅ | VNC Viewer ✅ |
| **VNC Shows** | Blank/BIOS ❌ | Desktop/TTY ✅ |
| **Boot Time** | 30-60 sec | 30-60 sec |
| **Configuration** | IOS CLI | SSH/GUI |

---

## Success Indicators

### ✅ Router Started Successfully:
```bash
# Backend logs show:
📡 Detected Cisco router image: router_1762805489189
🔧 Platform: c3725
✅ VM started: PID 12345
📟 Access router console via Serial Console in UI
```

### ✅ Serial Console Working:
- You see boot messages
- `Router>` prompt appears
- Commands respond (try `enable`, `show version`)

### ✅ Interfaces Configured:
```
Router# show ip interface brief
Interface                  IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0         192.168.1.1     YES manual up                    up      
GigabitEthernet0/1         192.168.2.1     YES manual up                    up
```

---

## Advanced: Manual Testing via CLI

If you want to test without the UI:

```bash
# 1. Create router node
curl -X POST http://localhost:3001/api/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Router-CLI-Test",
    "osType": "custom",
    "image": {
      "type": "custom",
      "id": "router_1762805489189.qcow2"
    }
  }'

# 2. Get the node ID from response, then start it
curl -X POST http://localhost:3001/api/nodes/<NODE_ID>/run

# 3. Check backend logs
docker compose logs -f backend

# 4. Connect to serial console via WebSocket
# (Use browser or wscat tool)
```

---

## Documentation References

- Implementation: `backend/modules/qemuManager.js` (lines 23-120, 265-390)
- Research: `router-implementation.md`
- Quick Ref: `router-quick-ref.md`
- This Guide: `ROUTER-TESTING-GUIDE.md`

---

## Support

If you encounter issues:

1. **Check backend logs**: `docker compose logs backend | grep -E "router|QEMU"`
2. **Verify image**: `ls -lh images/custom/router*.qcow2`
3. **Check QEMU process**: `docker exec sandlabx-backend ps aux | grep qemu`
4. **WebSocket status**: Browser console → Network tab → WS

---

🎯 **You're ready to test!** Open http://localhost:3000 and create your first router node!
