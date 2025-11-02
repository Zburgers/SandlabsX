#!/bin/bash
# PC1 Network Configuration Script
# Configures PC1 with IP: 192.168.1.2/24, Gateway: 192.168.1.1

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Configuring PC1 Network                                   ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  IP Address: 192.168.1.2/24                                ║"
echo "║  Gateway:    192.168.1.1                                   ║"
echo "║  Network:    192.168.1.0/24                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script requires root privileges"
    echo "   Re-running with sudo..."
    exec sudo "$0" "$@"
fi

# Detect network interface (usually eth0 or ens3)
INTERFACE=$(ip -o link show | awk -F': ' '{print $2}' | grep -E '^(eth0|ens3|enp)' | head -1)

if [ -z "$INTERFACE" ]; then
    echo "❌ No suitable network interface found"
    echo "   Available interfaces:"
    ip link show
    exit 1
fi

echo "Using interface: $INTERFACE"
echo ""

# Step 1: Configure IP address
echo "[1/5] Configuring IP address..."
ip addr flush dev "$INTERFACE" 2>/dev/null || true
ip addr add 192.168.1.2/24 dev "$INTERFACE"
ip link set "$INTERFACE" up
echo "  ✓ IP configured: 192.168.1.2/24"
echo ""

# Step 2: Add default gateway
echo "[2/5] Configuring default gateway..."
ip route flush dev "$INTERFACE" 2>/dev/null || true
ip route add default via 192.168.1.1 dev "$INTERFACE"
echo "  ✓ Gateway configured: 192.168.1.1"
echo ""

# Step 3: Test connectivity to gateway
echo "[3/5] Testing connectivity to gateway..."
if ping -c 2 -W 2 192.168.1.1 > /dev/null 2>&1; then
    echo "  ✓ Gateway reachable: 192.168.1.1"
else
    echo "  ⚠️  Gateway not responding (router may still be booting)"
fi
echo ""

# Step 4: Create persistent configuration
echo "[4/5] Creating persistent configuration..."

# Detect if using Netplan (Ubuntu 18.04+)
if [ -d /etc/netplan ]; then
    cat > /etc/netplan/01-netcfg.yaml <<EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    $INTERFACE:
      addresses:
        - 192.168.1.2/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
EOF
    chmod 600 /etc/netplan/01-netcfg.yaml
    netplan apply 2>/dev/null || true
    echo "  ✓ Netplan configuration saved"
    
# Fallback to traditional interfaces file
elif [ -f /etc/network/interfaces ]; then
    cat >> /etc/network/interfaces <<EOF

# Configuration for PC1
auto $INTERFACE
iface $INTERFACE inet static
    address 192.168.1.2
    netmask 255.255.255.0
    gateway 192.168.1.1
    dns-nameservers 8.8.8.8 8.8.4.4
EOF
    echo "  ✓ /etc/network/interfaces updated"
else
    echo "  ℹ️  No persistent network configuration method detected"
    echo "     Configuration will be lost on reboot"
fi
echo ""

# Step 5: Display configuration
echo "[5/5] Verifying configuration..."
echo ""
echo "Interface configuration:"
ip addr show "$INTERFACE"
echo ""
echo "Routing table:"
ip route show
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  PC1 Configuration Complete!                               ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Interface:  $INTERFACE"
echo "║  IP Address: 192.168.1.2/24                                ║"
echo "║  Gateway:    192.168.1.1                                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Test connectivity:"
echo "  ping 192.168.1.1    # Gateway (router)"
echo "  ping 192.168.2.2    # PC2 (via router)"
echo ""
