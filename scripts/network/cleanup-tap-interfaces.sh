#!/bin/bash
# Cleanup TAP interfaces and bridges
# Removes all network infrastructure created for the router lab

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Cleaning Up Network Infrastructure                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script requires sudo privileges"
    echo "   Re-running with sudo..."
    exec sudo "$0" "$@"
fi

# Function to safely delete interface
delete_interface() {
    local iface=$1
    if ip link show "$iface" &>/dev/null; then
        ip link delete "$iface"
        echo "  ✓ Deleted: $iface"
    else
        echo "  ℹ️  $iface does not exist (already deleted)"
    fi
}

echo "[1/2] Removing TAP interfaces..."
delete_interface "tap0"
delete_interface "tap1"
delete_interface "tap2"
delete_interface "tap3"
echo ""

echo "[2/2] Removing bridges..."
delete_interface "br0"
delete_interface "br1"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Network Cleanup Complete!                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✓ All TAP interfaces and bridges removed"
