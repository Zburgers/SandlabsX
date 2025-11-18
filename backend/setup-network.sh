#!/bin/bash
# Setup multi-bridge network for inter-VM communication
set -e

echo "🌉 Setting up SandboxLabs multi-bridge network..."

create_bridge() {
    local br_name=$1
    local ip_addr=$2
    local subnet=$3

    if ip link show "$br_name" &>/dev/null; then
        echo "  Bridge $br_name already exists"
    else
        echo "  Creating bridge $br_name..."
        ip link add name "$br_name" type bridge
        ip link set "$br_name" up
        ip addr add "$ip_addr/$subnet" dev "$br_name" || true
        echo "  ✅ Bridge created: $br_name ($ip_addr/$subnet)"
    fi
}

# Create two isolated lab bridges
create_bridge "sandlabx-br0" "192.168.1.1" "24"
create_bridge "sandlabx-br1" "192.168.2.1" "24"

# Enable IP forwarding (router bridging between lab segments)
echo "  Enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null

# Create QEMU ifup/ifdown helper scripts
echo "  Creating qemu-ifup and qemu-ifdown scripts..."

cat > /etc/qemu-ifup << 'EOF'
#!/bin/bash
# QEMU ifup script for attaching TAP interfaces to lab bridges

case "$1" in
  tap0) BRIDGE="sandlabx-br0" ;;
  tap1) BRIDGE="sandlabx-br1" ;;
  tap2) BRIDGE="sandlabx-br0" ;;
  tap3) BRIDGE="sandlabx-br1" ;;
  *)    BRIDGE="sandlabx-br0" ;; # default
esac

ip link set "$1" up
ip link set "$1" master "$BRIDGE"
exit 0
EOF

chmod +x /etc/qemu-ifup

cat > /etc/qemu-ifdown << 'EOF'
#!/bin/bash
# QEMU ifdown script for detaching TAP interfaces
ip link set "$1" nomaster
ip link set "$1" down
exit 0
EOF

chmod +x /etc/qemu-ifdown

echo "✅ Network setup complete!"
echo ""
echo "Bridges created:"
echo "  sandlabx-br0 -> 192.168.1.1/24 (Router G0/0 + PC1)"
echo "  sandlabx-br1 -> 192.168.2.1/24 (Router G0/1 + PC2)"
echo ""
echo "VMs will connect to the correct subnet based on tap interface:"
echo "  tap0, tap2 -> br0 (192.168.1.x)"
echo "  tap1, tap3 -> br1 (192.168.2.x)"
