# Quick Reference: Router Configuration for Task 2

## QEMU Command You Need

```bash
qemu-system-x86_64 \
  -machine pc \
  -cpu qemu64 \
  -m 256 \
  -hda /overlays/router-overlay.qcow2 \
  -nographic \
  -serial mon:stdio \
  -device e1000,netdev=net0 \
  -netdev user,id=net0 \
  -device e1000,netdev=net1 \
  -netdev user,id=net1
```

## Critical Points

1. **`-nographic`** - MUST HAVE - Routers have no graphics
2. **`-serial mon:stdio`** - Serial console as primary interface  
3. **Two `-device e1000` blocks** - Creates Gi0/0 and Gi0/1
4. **NO `-boot c`** - Router images don't need boot parameter
5. **NO `-vga std`** - Routers have no VGA output

## Router Configuration (Copy-Paste Ready)

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
```

## Verification Commands

```
show version
show ip interface brief
show running-config
ping 192.168.1.1
ping 192.168.2.1
```

## Expected Output

```
Router# show ip interface brief

Interface                  IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0         192.168.1.1     YES manual up                    up      
GigabitEthernet0/1         192.168.2.1     YES manual up                    up
```

## Why VNC is Blank

**This is NORMAL and EXPECTED!**

Physical Cisco routers have:
- ✅ Console port (RJ45) for serial connection
- ❌ NO monitor port (no VGA/HDMI)

Your serial console = The console port  
VNC showing blank = Correct (there's no video output to show)

## Access Router

1. Start router node
2. **Ignore VNC viewer** (will be blank)
3. Click **Serial Console** button
4. Wait 30-60 seconds for boot
5. You'll see `Router>` prompt
6. Type commands above

## Troubleshooting

**Problem:** Nothing in serial console  
**Solution:** Wait 60 seconds, router takes time to boot

**Problem:** ROMMON prompt (`rommon 1 >`)  
**Solution:** Type `boot` and press Enter

**Problem:** Only 1 interface showing  
**Solution:** Verify you have 2x `-device e1000` in QEMU args

**Problem:** Can't type commands  
**Solution:** WebSocket not connected, check browser console

## Code Changes Summary

File: `backend/modules/qemuManager.js`

Add 3 functions:
1. `isRouterImage()` - Detect router images
2. `detectRouterPlatform()` - Identify platform
3. `getRouterQemuArgs()` - Build router QEMU args

Modify 1 method:
- `startVM()` - Check if router, use different args

Total: ~80 lines of code
