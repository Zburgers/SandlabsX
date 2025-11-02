#!/bin/bash
# Complete Router Lab Setup Script
# Sets up a 3-VM network lab with Cisco router and 2 Linux PCs

set -e  # Exit on error

PROJECT_ROOT="/home/runner/work/SandlabsX/SandlabsX"
OVERLAYS_DIR="$PROJECT_ROOT/overlays"
IMAGES_DIR="$PROJECT_ROOT/images"
SCRIPTS_DIR="$PROJECT_ROOT/scripts/network"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  QEMU Router Networking Lab - Complete Setup              ║"
echo "║  Task 2: Routed Network with Cisco Router                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check QEMU
if ! command -v qemu-system-x86_64 &> /dev/null; then
    echo "❌ qemu-system-x86_64 not found"
    echo "   Install: sudo apt-get install qemu-system-x86 qemu-utils"
    exit 1
fi
echo "  ✓ QEMU installed"

# Check bridge-utils
if ! command -v brctl &> /dev/null; then
    echo "⚠️  bridge-utils not found (optional)"
    echo "   Install: sudo apt-get install bridge-utils"
fi

# Check for required images
if [ ! -f "$IMAGES_DIR/router.qcow2" ]; then
    echo "❌ Router image not found: $IMAGES_DIR/router.qcow2"
    echo "   Download: wget https://labs.networkgeek.in/router.qcow2 -O $IMAGES_DIR/router.qcow2"
    exit 1
fi
echo "  ✓ Router image found"

if [ ! -f "$IMAGES_DIR/ubuntu-24-lts.qcow2" ] && [ ! -f "$IMAGES_DIR/alpine-3.qcow2" ]; then
    echo "❌ Linux PC image not found"
    echo "   Need either: ubuntu-24-lts.qcow2 or alpine-3.qcow2 in $IMAGES_DIR"
    exit 1
fi

# Determine which Linux image to use
LINUX_IMAGE=""
if [ -f "$IMAGES_DIR/ubuntu-24-lts.qcow2" ]; then
    LINUX_IMAGE="$IMAGES_DIR/ubuntu-24-lts.qcow2"
    echo "  ✓ Using Ubuntu 24.04 LTS for PCs"
elif [ -f "$IMAGES_DIR/alpine-3.qcow2" ]; then
    LINUX_IMAGE="$IMAGES_DIR/alpine-3.qcow2"
    echo "  ✓ Using Alpine Linux for PCs"
fi

echo ""

# Step 1: Setup network infrastructure
echo "[1/6] Setting up network infrastructure..."
if [ -f "$SCRIPTS_DIR/create-tap-interfaces.sh" ]; then
    bash "$SCRIPTS_DIR/create-tap-interfaces.sh"
else
    echo "  ℹ️  Running inline network setup..."
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then 
        echo "  ⚠️  Network setup requires sudo"
        sudo bash -c "
            ip link add br0 type bridge 2>/dev/null || true
            ip link add br1 type bridge 2>/dev/null || true
            ip link set br0 up
            ip link set br1 up
            
            for tap in tap0 tap1 tap2 tap3; do
                ip tuntap add dev \$tap mode tap user $USER 2>/dev/null || true
                ip link set \$tap up
            done
            
            ip link set tap0 master br0
            ip link set tap1 master br0
            ip link set tap2 master br1
            ip link set tap3 master br1
        "
    fi
fi
echo ""

# Step 2: Create overlays directory
echo "[2/6] Preparing overlays directory..."
mkdir -p "$OVERLAYS_DIR"
echo "  ✓ Overlays directory ready: $OVERLAYS_DIR"
echo ""

# Step 3: Create VM overlays
echo "[3/6] Creating VM overlays..."

cd "$OVERLAYS_DIR"

if [ ! -f "router_node.qcow2" ]; then
    qemu-img create -f qcow2 -b "$IMAGES_DIR/router.qcow2" -F qcow2 router_node.qcow2
    echo "  ✓ Router overlay created"
else
    echo "  ℹ️  Router overlay already exists"
fi

if [ ! -f "pc1_node.qcow2" ]; then
    qemu-img create -f qcow2 -b "$LINUX_IMAGE" -F qcow2 pc1_node.qcow2
    echo "  ✓ PC1 overlay created"
else
    echo "  ℹ️  PC1 overlay already exists"
fi

if [ ! -f "pc2_node.qcow2" ]; then
    qemu-img create -f qcow2 -b "$LINUX_IMAGE" -F qcow2 pc2_node.qcow2
    echo "  ✓ PC2 overlay created"
else
    echo "  ℹ️  PC2 overlay already exists"
fi

echo ""

# Step 4: Launch VMs
echo "[4/6] Launching virtual machines..."

# Check if VMs are already running
if pgrep -f "qemu.*cisco-router" > /dev/null; then
    echo "  ℹ️  Router VM already running"
else
    qemu-system-x86_64 \
      -name "cisco-router" \
      -hda "$OVERLAYS_DIR/router_node.qcow2" \
      -m 2048 \
      -smp 2 \
      -vnc 0.0.0.0:0 \
      -netdev tap,id=net0,ifname=tap1,script=no,downscript=no \
      -device e1000,netdev=net0,mac=52:54:00:12:34:01 \
      -netdev tap,id=net1,ifname=tap2,script=no,downscript=no \
      -device e1000,netdev=net1,mac=52:54:00:12:34:02 \
      -enable-kvm \
      -daemonize 2>/dev/null
    echo "  ✓ Router launched (VNC :0, port 5900)"
fi

if pgrep -f "qemu.*linux-pc1" > /dev/null; then
    echo "  ℹ️  PC1 VM already running"
else
    qemu-system-x86_64 \
      -name "linux-pc1" \
      -hda "$OVERLAYS_DIR/pc1_node.qcow2" \
      -m 1024 \
      -smp 1 \
      -vnc 0.0.0.0:1 \
      -netdev tap,id=net0,ifname=tap0,script=no,downscript=no \
      -device e1000,netdev=net0,mac=52:54:00:12:34:10 \
      -enable-kvm \
      -daemonize 2>/dev/null
    echo "  ✓ PC1 launched (VNC :1, port 5901)"
fi

if pgrep -f "qemu.*linux-pc2" > /dev/null; then
    echo "  ℹ️  PC2 VM already running"
else
    qemu-system-x86_64 \
      -name "linux-pc2" \
      -hda "$OVERLAYS_DIR/pc2_node.qcow2" \
      -m 1024 \
      -smp 1 \
      -vnc 0.0.0.0:2 \
      -netdev tap,id=net0,ifname=tap3,script=no,downscript=no \
      -device e1000,netdev=net0,mac=52:54:00:12:34:20 \
      -enable-kvm \
      -daemonize 2>/dev/null
    echo "  ✓ PC2 launched (VNC :2, port 5902)"
fi

echo ""

# Step 5: Wait for VMs to boot
echo "[5/6] Waiting for VMs to boot..."
echo "  Router typically takes 2-3 minutes to fully boot..."
for i in {10..1}; do
    echo -ne "  Waiting... ${i}s remaining\r"
    sleep 1
done
echo "  ✓ Initial boot wait complete                   "
echo ""

# Step 6: Display setup information
echo "[6/6] Setup complete!"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Lab Setup Complete - Ready for Configuration              ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  VNC Console Access:                                       ║"
echo "║  ├─ Router:  vncviewer localhost:5900                     ║"
echo "║  ├─ PC1:     vncviewer localhost:5901                     ║"
echo "║  └─ PC2:     vncviewer localhost:5902                     ║"
echo "║                                                            ║"
echo "║  Or use Guacamole Web Interface:                           ║"
echo "║  └─ http://localhost:8081/guacamole                        ║"
echo "║     Login: guacadmin / guacadmin                           ║"
echo "║                                                            ║"
echo "║  Network Topology:                                         ║"
echo "║                                                            ║"
echo "║    PC1 (192.168.1.2) ──┐                                  ║"
echo "║                        ├─ Router ─┐                        ║"
echo "║    Network 1           │  (both   │    Network 2          ║"
echo "║    192.168.1.0/24      │  gateways│    192.168.2.0/24     ║"
echo "║                        │  .1)     │                        ║"
echo "║                        └──────────┴─ PC2 (192.168.2.2)    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo "1. Connect to Router via VNC (port 5900)"
echo "2. Configure router interfaces:"
echo "   - GigabitEthernet0/0: 192.168.1.1/24"
echo "   - GigabitEthernet0/1: 192.168.2.1/24"
echo "3. Configure PC1 (port 5901): 192.168.1.2/24, gateway 192.168.1.1"
echo "4. Configure PC2 (port 5902): 192.168.2.2/24, gateway 192.168.2.1"
echo "5. Test connectivity: PC1 ping PC2"
echo ""
echo "For detailed configuration commands, see:"
echo "  docs/ROUTER-NETWORKING-GUIDE.md"
echo ""
echo "To stop and cleanup the lab:"
echo "  ./scripts/network/cleanup-router-lab.sh"
