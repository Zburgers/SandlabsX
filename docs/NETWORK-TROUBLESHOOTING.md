# Network Troubleshooting Guide
## Router Networking Lab

**Version:** 1.0.0  
**Last Updated:** November 2, 2025

---

## 📋 Quick Diagnostic Checklist

Use this checklist to quickly identify issues:

```
[ ] Host system has sufficient resources (8+ GB RAM, 4+ cores)
[ ] QEMU and required tools installed
[ ] Router and PC images downloaded
[ ] Network bridges (br0, br1) created and up
[ ] TAP interfaces (tap0-tap3) created and attached to bridges
[ ] VMs launched successfully
[ ] VNC consoles accessible
[ ] Router interfaces configured with correct IPs
[ ] Router interfaces show "up/up" status
[ ] PC network interfaces configured
[ ] Default gateways configured on PCs
[ ] No firewall rules blocking traffic
[ ] No MAC address conflicts
```

---

## 🔍 Common Issues & Solutions

### Issue 1: Cannot Create TAP Interfaces

#### Symptoms
```bash
$ sudo ip tuntap add dev tap0 mode tap user $(whoami)
RTNETLINK answers: Operation not permitted
```

#### Diagnosis
```bash
# Check if TUN/TAP module is loaded
lsmod | grep tun

# Check /dev/net/tun exists
ls -l /dev/net/tun

# Check current user permissions
groups $(whoami)
```

#### Solutions

**Solution A: Load TUN/TAP kernel module**
```bash
sudo modprobe tun
echo "tun" | sudo tee -a /etc/modules
```

**Solution B: Fix /dev/net/tun permissions**
```bash
sudo mkdir -p /dev/net
sudo mknod /dev/net/tun c 10 200
sudo chmod 0666 /dev/net/tun
```

**Solution C: Add user to required groups**
```bash
sudo usermod -aG kvm,libvirt $(whoami)
# Logout and login again for changes to take effect
```

**Solution D: Run with sudo (temporary workaround)**
```bash
sudo ip tuntap add dev tap0 mode tap
sudo chown $(whoami):$(whoami) /dev/tap0
```

---

### Issue 2: QEMU Cannot Access TAP Interface

#### Symptoms
```bash
qemu-system-x86_64: -netdev tap,id=net0,ifname=tap0: could not configure /dev/net/tun (tap0): Operation not permitted
```

#### Diagnosis
```bash
# Check TAP interface ownership
ls -l /sys/class/net/tap0

# Check if interface exists
ip link show tap0

# Check QEMU binary permissions
ls -l $(which qemu-system-x86_64)
```

#### Solutions

**Solution A: Pre-create TAP with proper ownership**
```bash
sudo ip tuntap add dev tap0 mode tap user $(whoami)
sudo ip link set tap0 up
```

**Solution B: Give QEMU network capabilities**
```bash
sudo setcap cap_net_admin+ep /usr/bin/qemu-system-x86_64
```

**Solution C: Use helper script**
Create `/etc/qemu/bridge.conf`:
```bash
allow br0
allow br1
```

Then use:
```bash
-netdev bridge,id=net0,br=br0
```

**Solution D: Run QEMU with sudo (not recommended)**
```bash
sudo qemu-system-x86_64 [args...]
```

---

### Issue 3: Router VM Doesn't Boot

#### Symptoms
- VNC console shows blank screen
- QEMU process exits immediately
- No router prompt appears

#### Diagnosis
```bash
# Check if QEMU process is running
ps aux | grep qemu-system-x86_64

# Check router image
qemu-img info /home/runner/work/SandlabsX/SandlabsX/images/router.qcow2

# Test boot without network
qemu-system-x86_64 -hda router.qcow2 -vnc :0 -m 2048
```

#### Solutions

**Solution A: Increase boot time**
Router may take 2-5 minutes to boot. Wait longer.

**Solution B: Check image format**
```bash
# Convert if needed
qemu-img convert -f qcow2 -O qcow2 router.qcow2 router_fixed.qcow2
```

**Solution C: Increase memory**
```bash
# Cisco IOS needs at least 2GB
-m 2048  # or -m 4096 for better performance
```

**Solution D: Disable KVM if causing issues**
```bash
# Remove -enable-kvm flag
qemu-system-x86_64 [args without -enable-kvm]
```

**Solution E: Re-download router image**
```bash
cd images
rm router.qcow2
wget https://labs.networkgeek.in/router.qcow2
```

---

### Issue 4: Cannot Access VNC Console

#### Symptoms
```bash
$ vncviewer localhost:5900
Connection refused
```

#### Diagnosis
```bash
# Check if VNC port is listening
netstat -tln | grep 590[0-9]
# or
ss -tln | grep 590[0-9]

# Check if QEMU is running
ps aux | grep qemu

# Check VNC configuration
ps aux | grep qemu | grep vnc
```

#### Solutions

**Solution A: Verify VNC binding**
Ensure QEMU uses:
```bash
-vnc 0.0.0.0:0  # Not just -vnc :0
```

**Solution B: Check firewall**
```bash
# Ubuntu/Debian
sudo ufw status
sudo ufw allow 5900:5910/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=5900-5910/tcp --permanent
sudo firewall-cmd --reload
```

**Solution C: Use correct display number**
```bash
# VNC :0 = port 5900
# VNC :1 = port 5901
# VNC :2 = port 5902
vncviewer localhost:5900  # For display :0
```

**Solution D: Try different VNC client**
```bash
# Install alternative
sudo apt-get install -y tigervnc-viewer
vncviewer localhost:5900

# Or use web-based (via Guacamole)
# http://localhost:8081/guacamole
```

---

### Issue 5: Router Interfaces Won't Come Up

#### Symptoms
```cisco
Router# show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.1.1     YES manual administratively down down
```

#### Diagnosis
```cisco
! Check interface configuration
show running-config interface GigabitEthernet0/0

! Check interface details
show interfaces GigabitEthernet0/0

! Check for errors
show interfaces GigabitEthernet0/0 | include errors
```

#### Solutions

**Solution A: Enable interface**
```cisco
enable
configure terminal
interface GigabitEthernet0/0
 no shutdown
 exit
```

**Solution B: Verify network connection**
Ensure TAP interface is up on host:
```bash
sudo ip link set tap1 up
sudo ip link set tap2 up
```

**Solution C: Check for duplex mismatch**
```cisco
interface GigabitEthernet0/0
 duplex auto
 speed auto
 exit
```

**Solution D: Reset interface**
```cisco
interface GigabitEthernet0/0
 shutdown
 no shutdown
 exit
```

---

### Issue 6: PC1 Cannot Ping Gateway

#### Symptoms
```bash
$ ping 192.168.1.1
connect: Network is unreachable
# or
PING 192.168.1.1: 56 data bytes
Request timeout for icmp_seq 0
```

#### Diagnosis
```bash
# Check IP configuration
ip addr show eth0

# Check routing table
ip route

# Check ARP table
ip neigh

# Check if interface is up
ip link show eth0

# Test with tcpdump
sudo tcpdump -i eth0 icmp
```

#### Solutions

**Solution A: Verify IP configuration**
```bash
# Ensure correct IP is set
sudo ip addr add 192.168.1.2/24 dev eth0
sudo ip link set eth0 up

# Verify
ip addr show eth0
```

**Solution B: Add default route**
```bash
sudo ip route add default via 192.168.1.1
```

**Solution C: Check if interface is down**
```bash
sudo ip link set eth0 up
```

**Solution D: Verify subnet mask**
```bash
# Should be /24 (255.255.255.0)
# Not /32 or /16
ip addr add 192.168.1.2/24 dev eth0  # Correct
```

**Solution E: Flush old configuration**
```bash
# Remove all IPs from interface
sudo ip addr flush dev eth0

# Reconfigure
sudo ip addr add 192.168.1.2/24 dev eth0
sudo ip link set eth0 up
sudo ip route add default via 192.168.1.1
```

---

### Issue 7: PC1 Can Ping Gateway But Not PC2

#### Symptoms
```bash
$ ping 192.168.1.1
64 bytes from 192.168.1.1: icmp_seq=1 ttl=255 time=1.2 ms  ✓

$ ping 192.168.2.2
Request timeout for icmp_seq 0  ✗
```

#### Diagnosis
```bash
# From PC1
traceroute 192.168.2.2

# Check routing table on PC1
ip route

# On router
show ip route
show ip interface brief
ping 192.168.2.2
```

#### Solutions

**Solution A: Verify routing on router**
```cisco
! Ensure routing is enabled
Router# show ip route

! If no routes, enable IP routing
Router(config)# ip routing
```

**Solution B: Check router can reach both networks**
```cisco
! From router
ping 192.168.1.2  # Should work
ping 192.168.2.2  # Should work

! If not, check interface status
show ip interface brief
```

**Solution C: Verify default gateway on PCs**
```bash
# PC1 should have gateway 192.168.1.1
ip route | grep default

# If not set
sudo ip route add default via 192.168.1.1
```

**Solution D: Check firewall on PCs**
```bash
# Disable iptables temporarily for testing
sudo iptables -F
sudo iptables -P INPUT ACCEPT
sudo iptables -P FORWARD ACCEPT
sudo iptables -P OUTPUT ACCEPT
```

**Solution E: Check ARP tables**
```bash
# On PC1
ip neigh

# On PC2
ip neigh

# On router
show ip arp
```

---

### Issue 8: High Packet Loss or Latency

#### Symptoms
```bash
$ ping 192.168.2.2
64 bytes from 192.168.2.2: icmp_seq=1 ttl=63 time=250 ms
64 bytes from 192.168.2.2: icmp_seq=2 ttl=63 time=520 ms
```

#### Diagnosis
```bash
# Check host CPU usage
top
# Look for high CPU from qemu processes

# Check host memory
free -h

# Monitor network with iperf3
# On PC2:
iperf3 -s

# On PC1:
iperf3 -c 192.168.2.2
```

#### Solutions

**Solution A: Enable KVM acceleration**
```bash
# Ensure VMs launched with -enable-kvm
ps aux | grep qemu | grep enable-kvm

# Check KVM is available
ls -l /dev/kvm
```

**Solution B: Reduce VM memory if host is swapping**
```bash
# Check swap usage
free -h

# Reduce VM RAM
-m 1024  # Instead of -m 2048
```

**Solution C: Use virtio network drivers (if supported)**
```bash
-device virtio-net-pci,netdev=net0  # Instead of e1000
```

**Solution D: Increase network queue size**
```bash
-netdev tap,id=net0,ifname=tap0,queues=4
```

---

### Issue 9: Configuration Not Persistent After Reboot

#### Symptoms
After rebooting VM, network configuration is lost.

#### Solutions

**For Router (Cisco IOS):**
```cisco
! Always save configuration
Router# write memory
! or
Router# copy running-config startup-config
```

**For Linux PCs (Ubuntu with Netplan):**
```bash
# Create persistent configuration
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      addresses:
        - 192.168.1.2/24
      routes:
        - to: default
          via: 192.168.1.1
EOF

# Apply configuration
sudo netplan apply

# Verify it persists
sudo reboot
# After reboot, check:
ip addr show eth0
```

**For Linux PCs (Traditional /etc/network/interfaces):**
```bash
sudo tee /etc/network/interfaces > /dev/null <<EOF
auto eth0
iface eth0 inet static
    address 192.168.1.2
    netmask 255.255.255.0
    gateway 192.168.1.1
EOF

# Restart networking
sudo systemctl restart networking
```

---

### Issue 10: MAC Address Conflicts

#### Symptoms
- Intermittent connectivity
- ARP table shows wrong MAC for IP
- Multiple VMs responding to same MAC

#### Diagnosis
```bash
# Check MAC addresses on host
ip link show tap0
ip link show tap1
ip link show tap2
ip link show tap3

# Inside VMs
ip link show eth0

# On router
show interfaces | include bia
```

#### Solutions

**Solution A: Explicitly set unique MACs**
```bash
# When launching VMs, use unique MAC addresses
-device e1000,netdev=net0,mac=52:54:00:12:34:01  # Router GigE0/0
-device e1000,netdev=net1,mac=52:54:00:12:34:02  # Router GigE0/1
-device e1000,netdev=net0,mac=52:54:00:12:34:10  # PC1
-device e1000,netdev=net0,mac=52:54:00:12:34:20  # PC2
```

**MAC Address Registry:**
| Device | Interface | MAC Address |
|--------|-----------|-------------|
| Router | GigE0/0 | 52:54:00:12:34:01 |
| Router | GigE0/1 | 52:54:00:12:34:02 |
| PC1 | eth0 | 52:54:00:12:34:10 |
| PC2 | eth0 | 52:54:00:12:34:20 |

---

## 🔧 Diagnostic Commands Reference

### Host System (Linux)

#### Network Bridges
```bash
# List bridges
brctl show

# Show bridge details
bridge link show

# Show bridge MAC addresses
bridge fdb show br br0
```

#### TAP Interfaces
```bash
# List TAP interfaces
ip tuntap list

# Show TAP interface status
ip link show tap0

# Show TAP statistics
ip -s link show tap0
```

#### Port Listening
```bash
# Check VNC ports
netstat -tln | grep 590
ss -tln | grep 590

# Check all QEMU processes
ps aux | grep qemu-system-x86_64
```

### Router (Cisco IOS)

```cisco
! Interface status
show ip interface brief
show interfaces
show interfaces status

! Routing
show ip route
show ip protocols

! ARP table
show ip arp
show arp

! Configuration
show running-config
show startup-config

! Debugging (use carefully)
debug ip icmp
debug ip packet
undebug all  ! Stop debugging
```

### Linux PCs (Ubuntu/Alpine)

```bash
# Network interfaces
ip addr show
ip link show
ifconfig

# Routing table
ip route show
route -n

# ARP cache
ip neigh show
arp -a

# Connectivity
ping -c 4 <ip>
traceroute <ip>
mtr <ip>  # Real-time traceroute

# Network statistics
netstat -i
ip -s link show eth0

# DNS
cat /etc/resolv.conf
nslookup google.com

# Firewall
sudo iptables -L -n -v
sudo iptables -S
```

---

## 📊 Performance Monitoring

### Monitor Host Resources
```bash
# CPU usage
top
htop

# Memory usage
free -h
vmstat 1

# Disk I/O
iostat -x 1
iotop

# Network bandwidth
iftop -i br0
nethogs
```

### Monitor VM Resources

#### Inside VM (Linux)
```bash
# CPU and memory
top
htop

# Network
iftop
iperf3 -s  # Server mode

# Disk
df -h
iostat
```

#### From Host
```bash
# QEMU process stats
top -p $(pgrep qemu-system)

# Network traffic
tcpdump -i tap0 -n
```

---

## 🧪 Testing Tools

### Connectivity Testing
```bash
# Basic ping
ping -c 4 192.168.2.2

# Flood ping (as root)
sudo ping -f 192.168.2.2

# Specific packet size
ping -s 1400 192.168.2.2

# Traceroute
traceroute 192.168.2.2
mtr 192.168.2.2  # Continuous traceroute
```

### Bandwidth Testing
```bash
# Install iperf3
sudo apt-get install iperf3

# On server (PC2)
iperf3 -s

# On client (PC1)
iperf3 -c 192.168.2.2
iperf3 -c 192.168.2.2 -t 30  # Run for 30 seconds
iperf3 -c 192.168.2.2 -P 4   # 4 parallel streams
```

### Packet Capture
```bash
# Capture on host
sudo tcpdump -i tap0 -w /tmp/capture.pcap

# Capture inside VM
sudo tcpdump -i eth0 -w /tmp/capture.pcap

# Read capture
tcpdump -r /tmp/capture.pcap

# Filter ICMP
tcpdump -r /tmp/capture.pcap icmp

# Analyze with Wireshark
wireshark /tmp/capture.pcap
```

---

## 🚨 Emergency Recovery

### Complete Lab Reset
```bash
#!/bin/bash
# Emergency reset script

echo "Stopping all VMs..."
sudo pkill -9 qemu-system-x86_64

echo "Removing TAP interfaces..."
for tap in tap0 tap1 tap2 tap3; do
    sudo ip link delete $tap 2>/dev/null || true
done

echo "Removing bridges..."
sudo ip link delete br0 2>/dev/null || true
sudo ip link delete br1 2>/dev/null || true

echo "Removing overlays..."
rm -f overlays/router_node.qcow2
rm -f overlays/pc1_node.qcow2
rm -f overlays/pc2_node.qcow2

echo "Lab reset complete. Run setup script to restart."
```

### Router Factory Reset
```cisco
! On router console
enable
write erase
reload

! Confirm when prompted
```

### PC Network Reset
```bash
# Remove all IPs
sudo ip addr flush dev eth0

# Remove all routes
sudo ip route flush dev eth0

# Bring interface down and up
sudo ip link set eth0 down
sudo ip link set eth0 up

# Remove persistent configuration
sudo rm -f /etc/netplan/01-netcfg.yaml
```

---

## 📞 Getting Help

If you've tried the solutions above and still have issues:

1. **Gather diagnostic information:**
   ```bash
   # Save to a file
   {
       echo "=== System Info ==="
       uname -a
       echo ""
       echo "=== QEMU Version ==="
       qemu-system-x86_64 --version
       echo ""
       echo "=== Network Bridges ==="
       brctl show
       echo ""
       echo "=== TAP Interfaces ==="
       ip link show | grep tap
       echo ""
       echo "=== Running VMs ==="
       ps aux | grep qemu
       echo ""
       echo "=== VNC Ports ==="
       netstat -tln | grep 590
   } > diagnostic-info.txt
   ```

2. **Check project documentation:**
   - [Technical PRD](./TASK-2-ROUTER-NETWORKING-PRD.md)
   - [Setup Guide](./ROUTER-NETWORKING-GUIDE.md)
   - [Main README](../README.md)

3. **Review QEMU documentation:**
   - [QEMU Networking](https://wiki.qemu.org/Documentation/Networking)
   - [TAP/TUN Setup](https://wiki.qemu.org/Documentation/Networking/TAP)

4. **Check system logs:**
   ```bash
   # System messages
   sudo dmesg | tail -50
   
   # QEMU errors
   journalctl -xe | grep qemu
   ```

---

**Last Updated:** November 2, 2025  
**Version:** 1.0.0
