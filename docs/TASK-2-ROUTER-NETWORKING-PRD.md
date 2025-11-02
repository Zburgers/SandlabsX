# Technical PRD: QEMU Router Networking Lab Setup
## Task 2 - SandBoxLabs POC

**Document Version:** 1.0.0  
**Last Updated:** November 2, 2025  
**Status:** In Development  
**Author:** SandBoxLabs Engineering Team

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Requirements](#requirements)
3. [Network Topology](#network-topology)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Plan](#implementation-plan)
6. [Configuration Details](#configuration-details)
7. [Verification Procedures](#verification-procedures)
8. [Potential Issues & Mitigation](#potential-issues--mitigation)
9. [Integration with Existing System](#integration-with-existing-system)
10. [References](#references)

---

## 1. Executive Summary

### Objective
Set up a virtual network lab using QEMU that simulates a basic routed network topology consisting of one Cisco router and two Linux PC nodes. The lab will demonstrate inter-network routing capabilities and basic network configuration management.

### Scope
- Deploy 1 Cisco Router VM with dual network interfaces
- Deploy 2 Linux PC VMs with single network interfaces
- Configure IP addressing and routing
- Verify end-to-end connectivity between networks
- Integrate with existing SandLabsX infrastructure

### Success Criteria
- ✅ All three VMs (1 router + 2 PCs) successfully launched via QEMU
- ✅ Network interfaces properly configured with specified IP addresses
- ✅ Routing configured on Cisco router between two subnets
- ✅ PC1 (192.168.1.2) can successfully ping PC2 (192.168.2.2)
- ✅ Console access available via Guacamole for all VMs
- ✅ Configuration is reproducible and documented

---

## 2. Requirements

### 2.1 Hardware Requirements (Virtual)

#### Cisco Router VM
- **Image:** Cisco IOS Router QCOW2 image
- **Source:** https://labs.networkgeek.in/router.qcow2
- **Network Interfaces:** 2 (GigabitEthernet0/0, GigabitEthernet0/1)
- **RAM:** 2048 MB (minimum for Cisco IOS)
- **vCPUs:** 2
- **VNC Console:** Required for CLI access

#### Linux PC1 VM
- **Image:** Ubuntu 24.04 LTS or Alpine Linux (lightweight)
- **Network Interface:** 1 (eth0)
- **RAM:** 1024 MB
- **vCPUs:** 1
- **VNC Console:** Required

#### Linux PC2 VM
- **Image:** Ubuntu 24.04 LTS or Alpine Linux (lightweight)
- **Network Interface:** 1 (eth0)
- **RAM:** 1024 MB
- **vCPUs:** 1
- **VNC Console:** Required

### 2.2 Network Configuration

| Device | Interface | IP Address | Subnet Mask | Gateway |
|--------|-----------|------------|-------------|---------|
| Router | GigabitEthernet0/0 | 192.168.1.1 | 255.255.255.0 | N/A |
| Router | GigabitEthernet0/1 | 192.168.2.1 | 255.255.255.0 | N/A |
| Linux PC1 | eth0 | 192.168.1.2 | 255.255.255.0 | 192.168.1.1 |
| Linux PC2 | eth0 | 192.168.2.2 | 255.255.255.0 | 192.168.2.1 |

### 2.3 Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    QEMU Virtual Lab                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                         ┌─────────────┐  │
│  │  Linux PC1  │                         │  Linux PC2  │  │
│  │             │                         │             │  │
│  │ 192.168.1.2 │                         │ 192.168.2.2 │  │
│  │   eth0      │                         │   eth0      │  │
│  └──────┬──────┘                         └──────┬──────┘  │
│         │                                       │         │
│         │ Network: 192.168.1.0/24              │ Network: 192.168.2.0/24
│         │                                       │         │
│    ┌────▼───────────────────────────────────────▼────┐   │
│    │          Cisco Router (IOS)                     │   │
│    │                                                  │   │
│    │  GigE0/0: 192.168.1.1   GigE0/1: 192.168.2.1  │   │
│    │              [Routing Enabled]                  │   │
│    └─────────────────────────────────────────────────┘   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Technical Architecture

### 3.1 QEMU Networking Approaches

We will use **TAP interfaces** for network connectivity, which provides the most flexibility and native Layer 2 networking capabilities.

#### Option A: TAP Interfaces with Bridge (Recommended)
- Create separate TAP interfaces for each network segment
- Bridge TAP interfaces to connect VMs
- Provides true Layer 2 connectivity
- Most realistic network simulation

#### Option B: QEMU User Networking (Limited)
- Built-in QEMU user mode networking
- Simpler setup but limited functionality
- Not suitable for router scenarios (NAT-based)

**Selected Approach:** TAP Interfaces with Linux Bridge

### 3.2 Network Segmentation

```
┌────────────────────────────────────────────────────┐
│  Host System (QEMU Host)                           │
│                                                    │
│  ┌──────────────┐         ┌──────────────┐       │
│  │   br0        │         │   br1        │       │
│  │ Bridge for   │         │ Bridge for   │       │
│  │ 192.168.1.x  │         │ 192.168.2.x  │       │
│  └───┬──────┬───┘         └───┬──────┬───┘       │
│      │      │                 │      │           │
│  ┌───▼──┐ ┌─▼────┐       ┌───▼──┐ ┌─▼────┐     │
│  │ tap0 │ │ tap1 │       │ tap2 │ │ tap3 │     │
│  │PC1   │ │Router│       │Router│ │ PC2  │     │
│  │eth0  │ │GigE0/│       │GigE0/│ │ eth0 │     │
│  └──────┘ └──────┘       └──────┘ └──────┘     │
└────────────────────────────────────────────────────┘
```

### 3.3 QEMU Command Structure

#### Router VM Launch Command
```bash
qemu-system-x86_64 \
  -name "cisco-router" \
  -hda /overlays/router.qcow2 \
  -m 2048 \
  -smp 2 \
  -vnc 0.0.0.0:0 \
  -netdev tap,id=net0,ifname=tap1,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:01 \
  -netdev tap,id=net1,ifname=tap2,script=no,downscript=no \
  -device e1000,netdev=net1,mac=52:54:00:12:34:02 \
  -enable-kvm
```

#### PC1 VM Launch Command
```bash
qemu-system-x86_64 \
  -name "linux-pc1" \
  -hda /overlays/pc1.qcow2 \
  -m 1024 \
  -smp 1 \
  -vnc 0.0.0.0:1 \
  -netdev tap,id=net0,ifname=tap0,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:10 \
  -enable-kvm
```

#### PC2 VM Launch Command
```bash
qemu-system-x86_64 \
  -name "linux-pc2" \
  -hda /overlays/pc2.qcow2 \
  -m 1024 \
  -smp 1 \
  -vnc 0.0.0.0:2 \
  -netdev tap,id=net0,ifname=tap3,script=no,downscript=no \
  -device e1000,netdev=net0,mac=52:54:00:12:34:20 \
  -enable-kvm
```

---

## 4. Implementation Plan

### Phase 1: Preparation and Setup (Estimated: 1-2 hours)

#### 1.1 Download and Prepare Images
- [ ] Download Cisco Router image from https://labs.networkgeek.in/router.qcow2
- [ ] Verify image integrity and format
- [ ] Place in `/images/` directory
- [ ] Create overlays for each VM

#### 1.2 Host Network Setup
- [ ] Create Linux bridge `br0` for network 192.168.1.0/24
- [ ] Create Linux bridge `br1` for network 192.168.2.0/24
- [ ] Create TAP interfaces (tap0, tap1, tap2, tap3)
- [ ] Attach TAP interfaces to bridges

### Phase 2: VM Deployment (Estimated: 30 minutes)

#### 2.1 Launch VMs
- [ ] Launch Cisco Router VM with dual interfaces
- [ ] Launch PC1 VM connected to network 1
- [ ] Launch PC2 VM connected to network 2
- [ ] Verify VNC console access for all VMs

### Phase 3: Configuration (Estimated: 1 hour)

#### 3.1 Router Configuration
```cisco
enable
configure terminal

! Configure GigabitEthernet0/0
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 no shutdown
 exit

! Configure GigabitEthernet0/1
interface GigabitEthernet0/1
 ip address 192.168.2.1 255.255.255.0
 no shutdown
 exit

! Enable IP routing (usually enabled by default)
ip routing

! Save configuration
write memory
```

#### 3.2 PC1 Configuration (Ubuntu/Linux)
```bash
# Configure static IP
sudo ip addr add 192.168.1.2/24 dev eth0
sudo ip link set eth0 up

# Add default gateway
sudo ip route add default via 192.168.1.1

# Make persistent (Netplan for Ubuntu)
cat <<EOF | sudo tee /etc/netplan/01-netcfg.yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses: [192.168.1.2/24]
      routes:
        - to: default
          via: 192.168.1.1
EOF

sudo netplan apply
```

#### 3.3 PC2 Configuration (Ubuntu/Linux)
```bash
# Configure static IP
sudo ip addr add 192.168.2.2/24 dev eth0
sudo ip link set eth0 up

# Add default gateway
sudo ip route add default via 192.168.2.1

# Make persistent (Netplan for Ubuntu)
cat <<EOF | sudo tee /etc/netplan/01-netcfg.yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses: [192.168.2.2/24]
      routes:
        - to: default
          via: 192.168.2.1
EOF

sudo netplan apply
```

### Phase 4: Verification (Estimated: 30 minutes)

#### 4.1 Connectivity Tests
- [ ] PC1 ping gateway (192.168.1.1)
- [ ] PC2 ping gateway (192.168.2.1)
- [ ] PC1 ping PC2 (192.168.2.2)
- [ ] PC2 ping PC1 (192.168.1.2)
- [ ] Verify routing table on router
- [ ] Check interface statistics

---

## 5. Configuration Details

### 5.1 Router Startup Configuration

Save this configuration to enable automatic startup:

```cisco
version 15.x
!
hostname Router
!
interface GigabitEthernet0/0
 description Connection to Network 1
 ip address 192.168.1.1 255.255.255.0
 duplex auto
 speed auto
 no shutdown
!
interface GigabitEthernet0/1
 description Connection to Network 2
 ip address 192.168.2.1 255.255.255.0
 duplex auto
 speed auto
 no shutdown
!
ip routing
!
line con 0
 logging synchronous
 exec-timeout 0 0
line vty 0 4
 login
!
end
```

### 5.2 Network Interface Scripts

#### Create TAP Interface Script (`scripts/create-tap-interfaces.sh`)

```bash
#!/bin/bash
# Create TAP interfaces for QEMU networking

set -e

echo "Creating TAP interfaces and bridges..."

# Create bridges
sudo ip link add br0 type bridge
sudo ip link add br1 type bridge

# Bring bridges up
sudo ip link set br0 up
sudo ip link set br1 up

# Create TAP interfaces
sudo ip tuntap add dev tap0 mode tap user $(whoami)
sudo ip tuntap add dev tap1 mode tap user $(whoami)
sudo ip tuntap add dev tap2 mode tap user $(whoami)
sudo ip tuntap add dev tap3 mode tap user $(whoami)

# Attach TAP interfaces to bridges
sudo ip link set tap0 master br0
sudo ip link set tap1 master br0
sudo ip link set tap2 master br1
sudo ip link set tap3 master br1

# Bring up TAP interfaces
sudo ip link set tap0 up
sudo ip link set tap1 up
sudo ip link set tap2 up
sudo ip link set tap3 up

echo "Network setup complete!"
echo "Bridge br0 (192.168.1.0/24): tap0 (PC1), tap1 (Router GigE0/0)"
echo "Bridge br1 (192.168.2.0/24): tap2 (Router GigE0/1), tap3 (PC2)"
```

### 5.3 Enhanced QEMU Manager Support

The existing `qemuManager.js` will need extensions to support:
- Multiple network interfaces per VM
- TAP interface configuration
- Custom MAC addresses
- Network topology management

---

## 6. Verification Procedures

### 6.1 Pre-Launch Checks

```bash
# Verify QEMU installation
qemu-system-x86_64 --version

# Verify image files exist
ls -lh /images/router.qcow2
ls -lh /images/ubuntu-24-lts.qcow2

# Verify network bridges
brctl show

# Verify TAP interfaces
ip link show | grep tap
```

### 6.2 Post-Launch Verification

#### Router Verification
```cisco
! Check interface status
show ip interface brief

! Check routing table
show ip route

! Check interface configurations
show running-config interface GigabitEthernet0/0
show running-config interface GigabitEthernet0/1

! Test connectivity
ping 192.168.1.2
ping 192.168.2.2
```

#### PC1 Verification
```bash
# Check IP configuration
ip addr show eth0

# Check routing table
ip route

# Test connectivity
ping -c 4 192.168.1.1      # Gateway
ping -c 4 192.168.2.1      # Remote gateway
ping -c 4 192.168.2.2      # PC2
```

#### PC2 Verification
```bash
# Check IP configuration
ip addr show eth0

# Check routing table
ip route

# Test connectivity
ping -c 4 192.168.2.1      # Gateway
ping -c 4 192.168.1.1      # Remote gateway
ping -c 4 192.168.1.2      # PC1
```

### 6.3 End-to-End Connectivity Test Script

```bash
#!/bin/bash
# verify-connectivity.sh

echo "=== Network Lab Connectivity Test ==="
echo ""

echo "Testing from PC1 (192.168.1.2)..."
ssh user@192.168.1.2 "ping -c 2 192.168.1.1 && echo 'Gateway OK' || echo 'Gateway FAIL'"
ssh user@192.168.1.2 "ping -c 2 192.168.2.2 && echo 'PC2 OK' || echo 'PC2 FAIL'"

echo ""
echo "Testing from PC2 (192.168.2.2)..."
ssh user@192.168.2.2 "ping -c 2 192.168.2.1 && echo 'Gateway OK' || echo 'Gateway FAIL'"
ssh user@192.168.2.2 "ping -c 2 192.168.1.2 && echo 'PC1 OK' || echo 'PC1 FAIL'"

echo ""
echo "=== Test Complete ==="
```

---

## 7. Potential Issues & Mitigation

### 7.1 Critical Issues (Severity: High)

#### Issue 1: TAP Interface Permission Denied
**Description:** QEMU cannot create or access TAP interfaces without proper permissions.

**Impact:** VMs fail to start with network connectivity.

**Root Cause:** TAP interfaces require root privileges or specific user permissions.

**Mitigation:**
```bash
# Option A: Pre-create TAP interfaces with proper ownership
sudo ip tuntap add dev tap0 mode tap user $(whoami)
sudo chmod 0666 /dev/net/tun

# Option B: Use capabilities
sudo setcap cap_net_admin+ep /usr/bin/qemu-system-x86_64

# Option C: Run QEMU with sudo (not recommended for production)
sudo qemu-system-x86_64 ...
```

**Best Practice:** Pre-create TAP interfaces with proper permissions and use helper scripts.

---

#### Issue 2: Cisco Router Image Compatibility
**Description:** Downloaded Cisco IOS image may not boot properly or have missing features.

**Impact:** Router VM fails to start or routing doesn't work.

**Root Cause:** 
- Corrupted download
- Incompatible IOS version
- Missing hardware emulation features

**Mitigation:**
```bash
# Verify image integrity
sha256sum router.qcow2

# Test boot before full deployment
qemu-system-x86_64 -hda router.qcow2 -vnc :0 -m 2048

# Check image format
qemu-img info router.qcow2
```

**Best Practice:** Test router image independently before integration. Keep backup of known-good images.

---

#### Issue 3: Routing Not Working Between Networks
**Description:** PC1 and PC2 cannot ping each other despite correct IP configuration.

**Impact:** Lab objective not achieved.

**Root Cause:**
- IP routing not enabled on router
- Missing or incorrect default routes on PCs
- Firewall rules blocking traffic
- ARP issues

**Mitigation:**
```cisco
! On Router - Ensure routing is enabled
Router# show ip route
Router# show ip interface brief

! Verify routing is on
Router(config)# ip routing

! Check for access-lists
Router# show access-lists
```

```bash
# On PCs - Check routing table
ip route show

# Verify default gateway is set
ip route add default via 192.168.x.1

# Check for firewall rules
sudo iptables -L -n

# Flush iptables if needed
sudo iptables -F
```

**Best Practice:** Always verify routing table and interface status before troubleshooting connectivity.

---

### 7.2 High Priority Issues (Severity: Medium)

#### Issue 4: VNC Console Not Accessible
**Description:** Cannot access VM console via VNC for configuration.

**Impact:** Cannot configure VMs, delayed deployment.

**Root Cause:**
- VNC port conflict
- Firewall blocking VNC ports
- QEMU VNC not listening on correct interface

**Mitigation:**
```bash
# Check VNC port availability
netstat -tln | grep 590[0-9]

# Test VNC connection
vncviewer localhost:5900

# Ensure QEMU listens on all interfaces
qemu-system-x86_64 -vnc 0.0.0.0:0  # Not -vnc :0 only
```

**Best Practice:** Use dynamic port allocation and verify VNC connectivity immediately after VM start.

---

#### Issue 5: Network Performance Issues
**Description:** High latency or packet loss between VMs.

**Impact:** Unrealistic network simulation, poor user experience.

**Root Cause:**
- Insufficient host resources
- CPU throttling
- Network buffer overflow

**Mitigation:**
```bash
# Enable KVM acceleration
qemu-system-x86_64 -enable-kvm ...

# Increase network queue size
-netdev tap,id=net0,queues=4

# Use virtio network driver (if supported)
-device virtio-net-pci,netdev=net0
```

**Best Practice:** Always use KVM acceleration when available and monitor host resource usage.

---

### 7.3 Medium Priority Issues (Severity: Low)

#### Issue 6: Configuration Not Persistent After Reboot
**Description:** Network configurations reset after VM reboot.

**Impact:** Need to reconfigure after each restart, time consuming.

**Root Cause:**
- Configuration not saved to startup-config (router)
- Netplan configuration not applied (Linux)

**Mitigation:**

Router:
```cisco
Router# copy running-config startup-config
Router# write memory
```

Linux:
```bash
# Use Netplan for persistent configuration
sudo netplan apply

# Or use traditional interfaces file
sudo vi /etc/network/interfaces
```

**Best Practice:** Always save configurations and create base images with pre-configured settings.

---

#### Issue 7: MAC Address Conflicts
**Description:** Multiple VMs have same MAC address causing network issues.

**Impact:** Unpredictable network behavior, ARP conflicts.

**Root Cause:** QEMU auto-generates MAC addresses that may conflict.

**Mitigation:**
```bash
# Explicitly set unique MAC addresses
-device e1000,netdev=net0,mac=52:54:00:12:34:01  # Router GigE0/0
-device e1000,netdev=net1,mac=52:54:00:12:34:02  # Router GigE0/1
-device e1000,netdev=net0,mac=52:54:00:12:34:10  # PC1
-device e1000,netdev=net0,mac=52:54:00:12:34:20  # PC2
```

**Best Practice:** Maintain a MAC address registry for all VMs in the lab.

---

### 7.4 Resource Management Issues

#### Issue 8: Insufficient Host Memory
**Description:** Host runs out of memory when all VMs are running.

**Impact:** VMs crash or system becomes unstable.

**Calculation:**
- Router: 2048 MB
- PC1: 1024 MB
- PC2: 1024 MB
- Total VM Memory: 4096 MB (4 GB)
- Host OS + Services: ~2 GB
- **Minimum Host RAM: 8 GB**
- **Recommended Host RAM: 16 GB**

**Mitigation:**
- Reduce VM memory allocation if possible
- Enable memory overcommit carefully
- Use memory balloon drivers
- Monitor with `free -h` and adjust accordingly

---

## 8. Integration with Existing System

### 8.1 Backend API Extensions

The current backend needs minimal extensions to support router networking:

#### New Node Type: `router`
```javascript
// In nodeManager.js - createNode()
const nodeTypes = {
  'ubuntu': { /* existing */ },
  'alpine': { /* existing */ },
  'debian': { /* existing */ },
  'router': {
    baseImage: 'router.qcow2',
    ram: 2048,
    cpus: 2,
    interfaces: 2  // New property for multi-interface support
  }
};
```

#### Enhanced qemuManager for Multiple Interfaces
```javascript
// In qemuManager.js - startVM()
async startVM(node) {
  const qemuArgs = [/* existing args */];
  
  // Add network interfaces based on node configuration
  if (node.networkInterfaces && Array.isArray(node.networkInterfaces)) {
    node.networkInterfaces.forEach((netif, index) => {
      qemuArgs.push('-netdev', `tap,id=net${index},ifname=${netif.tap},script=no`);
      qemuArgs.push('-device', `e1000,netdev=net${index},mac=${netif.mac}`);
    });
  }
  
  // ... rest of existing code
}
```

### 8.2 Frontend UI Enhancements

#### New Node Type Selector
Add "Cisco Router" to the OS type dropdown in `CreateNodeModal.tsx`:

```typescript
const osTypes = [
  { value: 'ubuntu', label: 'Ubuntu 24.04 LTS' },
  { value: 'alpine', label: 'Alpine Linux' },
  { value: 'debian', label: 'Debian 12' },
  { value: 'router', label: 'Cisco Router' }, // New option
];
```

#### Network Topology Visualization
Consider adding a network topology view to visualize connections between nodes.

### 8.3 Database Schema Extensions

Update `nodes-state.json` structure to include:
```json
{
  "id": "uuid",
  "name": "cisco-router",
  "osType": "router",
  "networkInterfaces": [
    {
      "name": "GigabitEthernet0/0",
      "tap": "tap1",
      "mac": "52:54:00:12:34:01",
      "bridge": "br0"
    },
    {
      "name": "GigabitEthernet0/1",
      "tap": "tap2",
      "mac": "52:54:00:12:34:02",
      "bridge": "br1"
    }
  ]
}
```

---

## 9. File and Directory Structure

### 9.1 Proposed Directory Layout

```
SandlabsX/
├── docs/
│   ├── TASK-2-ROUTER-NETWORKING-PRD.md          # This document
│   ├── ROUTER-NETWORKING-GUIDE.md               # User guide
│   ├── NETWORK-TROUBLESHOOTING.md               # Troubleshooting guide
│   └── README.md                                 # Documentation index
├── images/
│   ├── router.qcow2                              # Cisco IOS router image
│   ├── ubuntu-24-lts.qcow2                       # Linux PC base image
│   └── README.md                                 # Images documentation
├── scripts/
│   ├── network/
│   │   ├── create-tap-interfaces.sh             # Setup TAP interfaces
│   │   ├── cleanup-tap-interfaces.sh            # Cleanup network
│   │   ├── setup-router-lab.sh                  # Complete lab setup
│   │   └── verify-connectivity.sh               # Test connectivity
│   └── router/
│       ├── router-initial-config.txt            # Router startup config
│       ├── pc1-network-config.sh                # PC1 network setup
│       └── pc2-network-config.sh                # PC2 network setup
├── backend/
│   ├── modules/
│   │   ├── qemuManager.js                       # Enhanced for multi-NIC
│   │   ├── nodeManager.js                       # Enhanced for router type
│   │   └── networkManager.js                    # New: Network topology
└── overlays/
    ├── router_<uuid>.qcow2                       # Router overlay
    ├── pc1_<uuid>.qcow2                          # PC1 overlay
    └── pc2_<uuid>.qcow2                          # PC2 overlay
```

---

## 10. References

### 10.1 External Resources

1. **Cisco IOS Router Image**
   - Download: https://labs.networkgeek.in/router.qcow2
   - Documentation: Cisco IOS Configuration Guide

2. **QEMU Documentation**
   - Networking: https://wiki.qemu.org/Documentation/Networking
   - TAP Interfaces: https://wiki.qemu.org/Documentation/Networking/TAP

3. **Linux Networking**
   - Bridge Utils: https://wiki.linuxfoundation.org/networking/bridge
   - TAP/TUN: https://www.kernel.org/doc/Documentation/networking/tuntap.txt

4. **Ubuntu Netplan**
   - Documentation: https://netplan.io/
   - Examples: https://netplan.io/examples

### 10.2 Related Documentation

- [SandLabsX README](../README.md) - Main project documentation
- [Backend API Documentation](../backend/README.md) - API reference
- [QEMU Manager Implementation](../backend/modules/qemuManager.js) - Source code
- [Quick Start Guide](../QUICK-START.md) - Getting started

---

## Appendix A: Quick Reference Commands

### QEMU Networking
```bash
# Create TAP interface
sudo ip tuntap add dev tap0 mode tap user $(whoami)

# Create bridge
sudo ip link add br0 type bridge

# Attach TAP to bridge
sudo ip link set tap0 master br0

# Launch with TAP network
qemu-system-x86_64 -netdev tap,id=net0,ifname=tap0,script=no -device e1000,netdev=net0
```

### Cisco Router
```cisco
! Show interfaces
show ip interface brief

! Configure interface
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 no shutdown

! Save config
write memory
```

### Linux Networking
```bash
# Configure IP
sudo ip addr add 192.168.1.2/24 dev eth0
sudo ip link set eth0 up

# Add route
sudo ip route add default via 192.168.1.1

# Test connectivity
ping 192.168.2.2
```

---

## Appendix B: Troubleshooting Checklist

- [ ] QEMU installed and accessible
- [ ] Router image downloaded and verified
- [ ] TAP interfaces created and attached to bridges
- [ ] VMs launched successfully
- [ ] VNC console accessible for all VMs
- [ ] Router interfaces configured with correct IPs
- [ ] Router interfaces in "up" state
- [ ] PC network interfaces configured
- [ ] Default gateways set on PCs
- [ ] PC1 can ping its gateway (192.168.1.1)
- [ ] PC2 can ping its gateway (192.168.2.1)
- [ ] PC1 can ping PC2 (192.168.2.2)
- [ ] PC2 can ping PC1 (192.168.1.2)

---

**Document History:**
- v1.0.0 - November 2, 2025 - Initial PRD creation
