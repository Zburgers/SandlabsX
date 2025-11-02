# Router Networking Lab - Setup Guide
## QEMU-Based Network Lab with Cisco Router

**Version:** 1.0.0  
**Last Updated:** November 2, 2025

---

## 📚 Quick Links

- [Technical PRD](./TASK-2-ROUTER-NETWORKING-PRD.md) - Complete technical specification
- [Main README](../README.md) - Project documentation
- [Troubleshooting Guide](./NETWORK-TROUBLESHOOTING.md) - Common issues and solutions

---

## 🎯 What You'll Build

A complete virtual network lab with:
- 1 Cisco IOS Router (2 network interfaces)
- 2 Linux PCs (Ubuntu/Alpine)
- 2 isolated networks connected via router
- Full routing capability between networks

**Network Diagram:**
```
PC1 (192.168.1.2) ──┐
                    ├─── Router (192.168.1.1) ──── Router (192.168.2.1) ───┐
                    │                                                        │
              Network 1                                                Network 2
              192.168.1.0/24                                           192.168.2.0/24
                                                                             │
                                                                            PC2 (192.168.2.2)
```

---

## 📋 Prerequisites

### System Requirements
- **OS:** Linux (Ubuntu 20.04+ recommended)
- **RAM:** 8 GB minimum, 16 GB recommended
- **CPU:** 4+ cores with VT-x/AMD-V support
- **Disk:** 20 GB free space
- **Privileges:** sudo/root access required

### Software Requirements
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y qemu-system-x86 qemu-utils bridge-utils net-tools

# Check installation
qemu-system-x86_64 --version
brctl --version
```

### Download Required Images

#### 1. Cisco Router Image
```bash
cd /home/runner/work/SandlabsX/SandlabsX/images
wget https://labs.networkgeek.in/router.qcow2

# Verify download
qemu-img info router.qcow2
```

Expected output:
```
image: router.qcow2
file format: qcow2
virtual size: 2 GiB
```

#### 2. Linux PC Image (if not already present)
```bash
# Ubuntu Cloud Image (recommended)
wget https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img \
  -O ubuntu-24-lts.qcow2

# Or Alpine Linux (lightweight)
wget https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.1-x86_64-uefi-cloudinit-r0.qcow2 \
  -O alpine-3.qcow2
```

---

## 🚀 Quick Start (3 Methods)

### Method 1: Automated Script (Easiest)

```bash
cd /home/runner/work/SandlabsX/SandlabsX

# Run the complete setup script
./scripts/network/setup-router-lab.sh

# This will:
# - Create network bridges and TAP interfaces
# - Launch all 3 VMs
# - Configure IP addresses
# - Set up routing
# - Verify connectivity
```

### Method 2: Using SandLabsX UI (Integrated)

```bash
# Start the SandLabsX services
./run-all.sh

# Open browser to http://localhost:3000
# 1. Create node: "cisco-router" (type: router)
# 2. Create node: "pc1" (type: ubuntu)
# 3. Create node: "pc2" (type: ubuntu)
# 4. Start all nodes
# 5. Configure via VNC console (see Configuration section)
```

### Method 3: Manual Setup (Learning)

Follow the step-by-step instructions below for full control.

---

## 📝 Step-by-Step Manual Setup

### Step 1: Prepare Host Network (5 minutes)

#### 1.1 Create Network Bridges
```bash
# Create bridge for Network 1 (192.168.1.0/24)
sudo ip link add br0 type bridge
sudo ip link set br0 up

# Create bridge for Network 2 (192.168.2.0/24)
sudo ip link add br1 type bridge
sudo ip link set br1 up

# Verify
brctl show
```

Expected output:
```
bridge name     bridge id               STP enabled     interfaces
br0             8000.000000000000       no
br1             8000.000000000000       no
```

#### 1.2 Create TAP Interfaces
```bash
# TAP interfaces for Network 1
sudo ip tuntap add dev tap0 mode tap user $(whoami)  # PC1
sudo ip tuntap add dev tap1 mode tap user $(whoami)  # Router GigE0/0

# TAP interfaces for Network 2
sudo ip tuntap add dev tap2 mode tap user $(whoami)  # Router GigE0/1
sudo ip tuntap add dev tap3 mode tap user $(whoami)  # PC2

# Attach to bridges
sudo ip link set tap0 master br0
sudo ip link set tap1 master br0
sudo ip link set tap2 master br1
sudo ip link set tap3 master br1

# Bring up all interfaces
for iface in tap0 tap1 tap2 tap3; do
    sudo ip link set $iface up
done

# Verify
ip link show | grep tap
```

### Step 2: Create VM Overlays (2 minutes)

```bash
cd /home/runner/work/SandlabsX/SandlabsX/overlays

# Create router overlay
qemu-img create -f qcow2 \
  -b ../images/router.qcow2 \
  -F qcow2 \
  router_node.qcow2

# Create PC1 overlay
qemu-img create -f qcow2 \
  -b ../images/ubuntu-24-lts.qcow2 \
  -F qcow2 \
  pc1_node.qcow2

# Create PC2 overlay
qemu-img create -f qcow2 \
  -b ../images/ubuntu-24-lts.qcow2 \
  -F qcow2 \
  pc2_node.qcow2

# Verify
ls -lh *.qcow2
```

### Step 3: Launch VMs (5 minutes)

#### 3.1 Launch Cisco Router
```bash
# Open a new terminal for Router
qemu-system-x86_64 \
  -name "cisco-router" \
  -hda /home/runner/work/SandlabsX/SandlabsX/overlays/router_node.qcow2 \
  -m 2048 \
  -smp 2 \
  -vnc 0.0.0.0:0 \
  -netdev tap,id=net0,ifname=tap1,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:01 \
  -netdev tap,id=net1,ifname=tap2,script=no,downscript=no \
  -device e1000,netdev=net1,mac=52:54:00:12:34:02 \
  -enable-kvm &

echo "Router launched on VNC :0 (port 5900)"
```

#### 3.2 Launch PC1
```bash
# Open a new terminal for PC1
qemu-system-x86_64 \
  -name "linux-pc1" \
  -hda /home/runner/work/SandlabsX/SandlabsX/overlays/pc1_node.qcow2 \
  -m 1024 \
  -smp 1 \
  -vnc 0.0.0.0:1 \
  -netdev tap,id=net0,ifname=tap0,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:10 \
  -enable-kvm &

echo "PC1 launched on VNC :1 (port 5901)"
```

#### 3.3 Launch PC2
```bash
# Open a new terminal for PC2
qemu-system-x86_64 \
  -name "linux-pc2" \
  -hda /home/runner/work/SandlabsX/SandlabsX/overlays/pc2_node.qcow2 \
  -m 1024 \
  -smp 1 \
  -vnc 0.0.0.0:2 \
  -netdev tap,id=net0,ifname=tap3,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:20 \
  -enable-kvm &

echo "PC2 launched on VNC :2 (port 5902)"
```

#### 3.4 Connect to VMs via VNC
```bash
# Install VNC viewer if not present
sudo apt-get install -y tigervnc-viewer

# Connect to Router
vncviewer localhost:5900 &

# Connect to PC1
vncviewer localhost:5901 &

# Connect to PC2
vncviewer localhost:5902 &
```

Or use Guacamole web interface:
```
http://localhost:8081/guacamole
Login: guacadmin / guacadmin
```

### Step 4: Configure Router (10 minutes)

Connect to Router VNC console and run:

```cisco
! Wait for router to boot (may take 2-3 minutes)
! Press Enter to get prompt

enable
configure terminal

! Set hostname
hostname Router

! Configure GigabitEthernet0/0 (Network 1)
interface GigabitEthernet0/0
 description Connection to Network 1 (PC1)
 ip address 192.168.1.1 255.255.255.0
 no shutdown
 exit

! Configure GigabitEthernet0/1 (Network 2)
interface GigabitEthernet0/1
 description Connection to Network 2 (PC2)
 ip address 192.168.2.1 255.255.255.0
 no shutdown
 exit

! Enable IP routing (should be on by default)
ip routing

! Exit and save
exit
write memory

! Verify configuration
show ip interface brief
show ip route
```

Expected output for `show ip interface brief`:
```
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.1.1     YES manual up                    up
GigabitEthernet0/1     192.168.2.1     YES manual up                    up
```

### Step 5: Configure PC1 (5 minutes)

Connect to PC1 VNC console:

```bash
# Login to Ubuntu (use cloud-init default or your credentials)
# Default: ubuntu / ubuntu (change on first login)

# Configure network interface
sudo ip addr add 192.168.1.2/24 dev eth0
sudo ip link set eth0 up

# Add default route
sudo ip route add default via 192.168.1.1

# Verify
ip addr show eth0
ip route

# Test connectivity to gateway
ping -c 4 192.168.1.1
```

**Make Configuration Persistent:**
```bash
# Using Netplan (Ubuntu 20.04+)
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

sudo netplan apply
```

### Step 6: Configure PC2 (5 minutes)

Connect to PC2 VNC console:

```bash
# Login to Ubuntu

# Configure network interface
sudo ip addr add 192.168.2.2/24 dev eth0
sudo ip link set eth0 up

# Add default route
sudo ip route add default via 192.168.2.1

# Verify
ip addr show eth0
ip route

# Test connectivity to gateway
ping -c 4 192.168.2.1
```

**Make Configuration Persistent:**
```bash
# Using Netplan
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      addresses:
        - 192.168.2.2/24
      routes:
        - to: default
          via: 192.168.2.1
EOF

sudo netplan apply
```

---

## ✅ Verification & Testing

### Test 1: PC1 to Gateway
```bash
# On PC1
ping -c 4 192.168.1.1

# Expected: 4 packets transmitted, 4 received, 0% packet loss
```

### Test 2: PC2 to Gateway
```bash
# On PC2
ping -c 4 192.168.2.1

# Expected: 4 packets transmitted, 4 received, 0% packet loss
```

### Test 3: PC1 to PC2 (Inter-Network)
```bash
# On PC1
ping -c 4 192.168.2.2

# Expected: 4 packets transmitted, 4 received, 0% packet loss
# This proves routing is working!
```

### Test 4: PC2 to PC1 (Inter-Network)
```bash
# On PC2
ping -c 4 192.168.1.2

# Expected: 4 packets transmitted, 4 received, 0% packet loss
```

### Test 5: Traceroute
```bash
# On PC1 - trace path to PC2
traceroute 192.168.2.2

# Expected output:
# 1  192.168.1.1 (192.168.1.1)  1-2 ms
# 2  192.168.2.2 (192.168.2.2)  2-3 ms
```

### Router Verification Commands
```cisco
! On Router
show ip interface brief        # Show all interfaces and IPs
show ip route                   # Show routing table
show interfaces                 # Detailed interface stats
show ip arp                     # ARP table
show running-config             # Full configuration
```

---

## 🛠️ Automated Setup Script

Save this as `scripts/network/setup-router-lab.sh`:

```bash
#!/bin/bash
# Automated Router Lab Setup Script

set -e  # Exit on error

PROJECT_ROOT="/home/runner/work/SandlabsX/SandlabsX"
OVERLAYS_DIR="$PROJECT_ROOT/overlays"
IMAGES_DIR="$PROJECT_ROOT/images"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  QEMU Router Networking Lab - Automated Setup             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Create network bridges
echo "[1/6] Creating network bridges..."
sudo ip link add br0 type bridge 2>/dev/null || echo "  br0 already exists"
sudo ip link add br1 type bridge 2>/dev/null || echo "  br1 already exists"
sudo ip link set br0 up
sudo ip link set br1 up
echo "  ✓ Bridges created: br0, br1"

# Step 2: Create TAP interfaces
echo ""
echo "[2/6] Creating TAP interfaces..."
for tap in tap0 tap1 tap2 tap3; do
    sudo ip tuntap add dev $tap mode tap user $(whoami) 2>/dev/null || echo "  $tap already exists"
    sudo ip link set $tap up
done

# Attach to bridges
sudo ip link set tap0 master br0
sudo ip link set tap1 master br0
sudo ip link set tap2 master br1
sudo ip link set tap3 master br1
echo "  ✓ TAP interfaces created and attached to bridges"

# Step 3: Create VM overlays
echo ""
echo "[3/6] Creating VM overlays..."
cd "$OVERLAYS_DIR"

if [ ! -f router_node.qcow2 ]; then
    qemu-img create -f qcow2 -b "$IMAGES_DIR/router.qcow2" -F qcow2 router_node.qcow2
    echo "  ✓ Router overlay created"
else
    echo "  ℹ Router overlay already exists"
fi

if [ ! -f pc1_node.qcow2 ]; then
    qemu-img create -f qcow2 -b "$IMAGES_DIR/ubuntu-24-lts.qcow2" -F qcow2 pc1_node.qcow2
    echo "  ✓ PC1 overlay created"
else
    echo "  ℹ PC1 overlay already exists"
fi

if [ ! -f pc2_node.qcow2 ]; then
    qemu-img create -f qcow2 -b "$IMAGES_DIR/ubuntu-24-lts.qcow2" -F qcow2 pc2_node.qcow2
    echo "  ✓ PC2 overlay created"
else
    echo "  ℹ PC2 overlay already exists"
fi

# Step 4: Launch VMs
echo ""
echo "[4/6] Launching virtual machines..."

# Launch Router
qemu-system-x86_64 \
  -name "cisco-router" \
  -hda "$OVERLAYS_DIR/router_node.qcow2" \
  -m 2048 -smp 2 \
  -vnc 0.0.0.0:0 \
  -netdev tap,id=net0,ifname=tap1,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:01 \
  -netdev tap,id=net1,ifname=tap2,script=no,downscript=no \
  -device e1000,netdev=net1,mac=52:54:00:12:34:02 \
  -enable-kvm -daemonize
echo "  ✓ Router launched (VNC :0, port 5900)"

# Launch PC1
qemu-system-x86_64 \
  -name "linux-pc1" \
  -hda "$OVERLAYS_DIR/pc1_node.qcow2" \
  -m 1024 -smp 1 \
  -vnc 0.0.0.0:1 \
  -netdev tap,id=net0,ifname=tap0,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:10 \
  -enable-kvm -daemonize
echo "  ✓ PC1 launched (VNC :1, port 5901)"

# Launch PC2
qemu-system-x86_64 \
  -name "linux-pc2" \
  -hda "$OVERLAYS_DIR/pc2_node.qcow2" \
  -m 1024 -smp 1 \
  -vnc 0.0.0.0:2 \
  -netdev tap,id=net0,ifname=tap3,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:20 \
  -enable-kvm -daemonize
echo "  ✓ PC2 launched (VNC :2, port 5902)"

# Step 5: Wait for VMs to boot
echo ""
echo "[5/6] Waiting for VMs to boot (60 seconds)..."
sleep 60

# Step 6: Display connection info
echo ""
echo "[6/6] Setup complete!"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  VNC Console Access                                        ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Router:  vncviewer localhost:5900                         ║"
echo "║  PC1:     vncviewer localhost:5901                         ║"
echo "║  PC2:     vncviewer localhost:5902                         ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Or use Guacamole: http://localhost:8081/guacamole        ║"
echo "║  Login: guacadmin / guacadmin                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Connect to Router via VNC and configure interfaces"
echo "2. Connect to PC1 and PC2 via VNC and configure networking"
echo "3. Test connectivity with ping commands"
echo ""
echo "See docs/ROUTER-NETWORKING-GUIDE.md for configuration commands"
```

Make it executable:
```bash
chmod +x scripts/network/setup-router-lab.sh
```

---

## 🧹 Cleanup

To stop and clean up the lab:

```bash
# Stop all VMs
sudo pkill qemu-system-x86_64

# Remove TAP interfaces
for tap in tap0 tap1 tap2 tap3; do
    sudo ip link delete $tap
done

# Remove bridges
sudo ip link delete br0
sudo ip link delete br1

# Remove overlays (optional - keeps base images)
rm overlays/router_node.qcow2
rm overlays/pc1_node.qcow2
rm overlays/pc2_node.qcow2
```

Or use the cleanup script:
```bash
./scripts/network/cleanup-router-lab.sh
```

---

## 📊 Resource Usage

| Component | RAM | vCPUs | Disk | VNC Port |
|-----------|-----|-------|------|----------|
| Router    | 2 GB | 2     | ~500 MB | 5900 |
| PC1       | 1 GB | 1     | ~200 MB | 5901 |
| PC2       | 1 GB | 1     | ~200 MB | 5902 |
| **Total** | **4 GB** | **4** | **~900 MB** | - |

**Host Requirements:**
- Minimum: 8 GB RAM, 4 cores
- Recommended: 16 GB RAM, 8 cores

---

## 📚 Additional Resources

- [Technical PRD](./TASK-2-ROUTER-NETWORKING-PRD.md) - Complete technical specification
- [Network Troubleshooting Guide](./NETWORK-TROUBLESHOOTING.md) - Common issues
- [Cisco IOS Commands Cheat Sheet](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/fundamentals/command/cf_command_ref.html)
- [QEMU Networking Documentation](https://wiki.qemu.org/Documentation/Networking)

---

## 🎓 Learning Objectives

By completing this lab, you will learn:
- ✅ How to set up virtual networks with QEMU
- ✅ TAP interface and bridge networking
- ✅ Cisco IOS router configuration
- ✅ Static routing between networks
- ✅ Linux network configuration with Netplan
- ✅ Network troubleshooting and verification

---

**Last Updated:** November 2, 2025  
**Version:** 1.0.0
