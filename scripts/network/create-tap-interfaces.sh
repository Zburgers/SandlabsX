#!/bin/bash
# Setup TAP interfaces and bridges for QEMU router networking lab
# This script creates the network infrastructure needed for the lab

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Creating TAP Interfaces and Bridges                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script requires sudo privileges"
    echo "   Re-running with sudo..."
    exec sudo "$0" "$@"
fi

# Function to create bridge if it doesn't exist
create_bridge() {
    local bridge_name=$1
    if ip link show "$bridge_name" &>/dev/null; then
        echo "  ℹ️  Bridge $bridge_name already exists"
    else
        ip link add "$bridge_name" type bridge
        echo "  ✓ Created bridge: $bridge_name"
    fi
    ip link set "$bridge_name" up
}

# Function to create TAP interface if it doesn't exist
create_tap() {
    local tap_name=$1
    local user=$2
    if ip link show "$tap_name" &>/dev/null; then
        echo "  ℹ️  TAP interface $tap_name already exists"
    else
        ip tuntap add dev "$tap_name" mode tap user "$user"
        echo "  ✓ Created TAP: $tap_name"
    fi
    ip link set "$tap_name" up
}

# Function to attach TAP to bridge
attach_to_bridge() {
    local tap_name=$1
    local bridge_name=$2
    
    # Check if already attached
    if bridge link show | grep -q "$tap_name"; then
        echo "  ℹ️  $tap_name already attached to a bridge"
    else
        ip link set "$tap_name" master "$bridge_name"
        echo "  ✓ Attached $tap_name to $bridge_name"
    fi
}

# Get the actual user (not root) who invoked sudo
ACTUAL_USER=${SUDO_USER:-$USER}

echo "[1/3] Creating network bridges..."
create_bridge "br0"
create_bridge "br1"
echo ""

echo "[2/3] Creating TAP interfaces..."
create_tap "tap0" "$ACTUAL_USER"
create_tap "tap1" "$ACTUAL_USER"
create_tap "tap2" "$ACTUAL_USER"
create_tap "tap3" "$ACTUAL_USER"
echo ""

echo "[3/3] Attaching TAP interfaces to bridges..."
attach_to_bridge "tap0" "br0"
attach_to_bridge "tap1" "br0"
attach_to_bridge "tap2" "br1"
attach_to_bridge "tap3" "br1"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Network Setup Complete!                                   ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Network 1 (192.168.1.0/24): br0                          ║"
echo "║    - tap0: PC1 eth0                                        ║"
echo "║    - tap1: Router GigabitEthernet0/0                       ║"
echo "║                                                            ║"
echo "║  Network 2 (192.168.2.0/24): br1                          ║"
echo "║    - tap2: Router GigabitEthernet0/1                       ║"
echo "║    - tap3: PC2 eth0                                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Show current bridge configuration
echo "Current bridge configuration:"
brctl show 2>/dev/null || bridge link show
echo ""

echo "✓ Ready to launch VMs!"
