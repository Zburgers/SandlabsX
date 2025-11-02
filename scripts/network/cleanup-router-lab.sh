#!/bin/bash
# Complete Router Lab Cleanup Script
# Stops VMs and removes all lab infrastructure

set -e

PROJECT_ROOT="/home/runner/work/SandlabsX/SandlabsX"
OVERLAYS_DIR="$PROJECT_ROOT/overlays"
SCRIPTS_DIR="$PROJECT_ROOT/scripts/network"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  QEMU Router Lab - Complete Cleanup                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Stop VMs
echo "[1/3] Stopping virtual machines..."

# Count running VMs
VM_COUNT=$(pgrep -f "qemu-system-x86_64" | wc -l || echo 0)

if [ "$VM_COUNT" -gt 0 ]; then
    echo "  Found $VM_COUNT running QEMU VM(s)"
    
    # Try graceful shutdown first
    echo "  Sending SIGTERM (graceful shutdown)..."
    pkill -SIGTERM qemu-system-x86_64 2>/dev/null || true
    
    # Wait a few seconds
    sleep 3
    
    # Force kill if still running
    VM_COUNT=$(pgrep -f "qemu-system-x86_64" | wc -l || echo 0)
    if [ "$VM_COUNT" -gt 0 ]; then
        echo "  Force killing remaining VMs..."
        pkill -SIGKILL qemu-system-x86_64 2>/dev/null || true
    fi
    
    echo "  ✓ All VMs stopped"
else
    echo "  ℹ️  No VMs running"
fi

echo ""

# Step 2: Cleanup network infrastructure
echo "[2/3] Cleaning up network infrastructure..."

if [ -f "$SCRIPTS_DIR/cleanup-tap-interfaces.sh" ]; then
    bash "$SCRIPTS_DIR/cleanup-tap-interfaces.sh"
else
    echo "  ℹ️  Running inline cleanup..."
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then 
        sudo bash -c "
            for tap in tap0 tap1 tap2 tap3; do
                ip link delete \$tap 2>/dev/null || true
            done
            ip link delete br0 2>/dev/null || true
            ip link delete br1 2>/dev/null || true
        "
    else
        for tap in tap0 tap1 tap2 tap3; do
            ip link delete $tap 2>/dev/null || true
        done
        ip link delete br0 2>/dev/null || true
        ip link delete br1 2>/dev/null || true
    fi
    echo "  ✓ Network interfaces cleaned up"
fi

echo ""

# Step 3: Option to remove overlays
echo "[3/3] Overlay management..."
echo ""
echo "Overlay files contain VM state and data:"
ls -lh "$OVERLAYS_DIR"/*.qcow2 2>/dev/null || echo "  No overlays found"
echo ""
read -p "Do you want to DELETE overlay files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f "$OVERLAYS_DIR/router_node.qcow2"
    rm -f "$OVERLAYS_DIR/pc1_node.qcow2"
    rm -f "$OVERLAYS_DIR/pc2_node.qcow2"
    echo "  ✓ Overlay files deleted"
else
    echo "  ℹ️  Overlay files preserved (VMs will retain their state)"
fi

echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Cleanup Complete!                                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✓ All VMs stopped"
echo "✓ Network infrastructure removed"
echo ""
echo "To recreate the lab:"
echo "  ./scripts/network/setup-router-lab.sh"
