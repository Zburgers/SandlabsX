#!/bin/bash

# SandBoxLabs POC - Task 2
# Network Lab Setup: 1 Cisco Router + 2 Debian PCs
#
# Network Topology:
#   PC1 (192.168.1.2) <--> [Gi0/0] Router [Gi0/1] <--> PC2 (192.168.2.2)
#
# Networks:
#   - 192.168.1.0/24: PC1 <-> Router Gi0/0
#   - 192.168.2.0/24: PC2 <-> Router Gi0/1

set -e

API_BASE="http://localhost:3001/api"

echo "� SandBoxLabs POC - Task 2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Setting up: 1 Cisco Router + 2 Debian PCs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to wait for API
wait_for_api() {
    echo "⏳ Waiting for API to be ready..."
    for i in {1..30}; do
        if curl -sf "$API_BASE/nodes" > /dev/null 2>&1; then
            echo "✅ API is ready"
            return 0
        fi
        echo "   Attempt $i/30..."
        sleep 2
    done
    echo "❌ API not available"
    exit 1
}

# Function to create a node
create_node() {
    local name=$1
    local os=$2
    local ram=$3
    local cpu=$4
    
    echo "📦 Creating $name ($os)..." >&2
    
    response=$(curl -sf -X POST "$API_BASE/nodes" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$name\",
            \"osType\": \"$os\",
            \"resources\": {
                \"ram\": $ram,
                \"cpus\": $cpu
            }
        }")
    
    node_id=$(echo "$response" | jq -r '.id')
    echo "   ✅ Created: $node_id" >&2
    echo "$node_id"
}

# Function to start a node
start_node() {
    local node_id=$1
    local name=$2
    
    echo "▶️  Starting $name..."
    
    response=$(curl -s -X POST "$API_BASE/nodes/$node_id/run")
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        echo "   ✅ Started"
    else
        echo "   ❌ Failed to start: $response" >&2
        return 1
    fi
}

# Wait for API
wait_for_api

echo ""
echo "🏗️  Creating nodes..."
echo ""

# Create Cisco Router (no auto-config)
router_id=$(create_node "Router1" "router" 1024 1)
sleep 2

# Create PC1 (Debian)
pc1_id=$(create_node "PC1" "debian" 1024 1)
sleep 2

# Create PC2 (Debian)
pc2_id=$(create_node "PC2" "debian" 1024 1)
sleep 2

echo ""
echo "🚀 Starting nodes..."
echo ""

# Start Router (allow IOS to finish booting manually)
start_node "$router_id" "Router1"
echo "   ⏳ Router boot time: ~3 minutes"
sleep 5

# Start PC1
start_node "$pc1_id" "PC1"
sleep 5

# Start PC2
start_node "$pc2_id" "PC2"
sleep 5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ LAB SETUP COMPLETE (manual router + PC config required)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Network Topology:"
echo ""
echo "  PC1 (192.168.1.2)"
echo "       |"
echo "       | Network 1: 192.168.1.0/24"
echo "       |"
echo "  [Gi0/0] Router [Gi0/1]"
echo "    (192.168.1.1)  (192.168.2.1)"
echo "                |"
echo "                | Network 2: 192.168.2.0/24"
echo "                |"
echo "            PC2 (192.168.2.2)"
echo ""
echo "🆔 Node IDs:"
echo "   Router: $router_id"
echo "   PC1:    $pc1_id"
echo "   PC2:    $pc2_id"
echo ""
echo "Bridges and TAP mapping (auto-created by backend):"
echo "   sandlabx-br0 -> 192.168.1.0/24 : Router Gi0/0 (tap0) + PC1 (tap2)"
echo "   sandlabx-br1 -> 192.168.2.0/24 : Router Gi0/1 (tap1) + PC2 (tap3)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 NEXT STEPS - MANUAL ROUTER + PC CONFIG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Router CLI (serial console)"
echo "--------------------------------------------"
echo "hostname Router1"
echo "no enable secret"
echo "interface GigabitEthernet0/0"
echo " ip address 192.168.1.1 255.255.255.0"
echo " no shutdown"
echo "exit"
echo "interface GigabitEthernet0/1"
echo " ip address 192.168.2.1 255.255.255.0"
echo " no shutdown"
echo "exit"
echo "ip route 0.0.0.0 0.0.0.0 GigabitEthernet0/0"
echo "end"
echo "show ip interface brief"
echo ""
echo "PC1 (ens3)"
echo "--------------------------------------------"
echo "sudo ip addr flush dev ens3"
echo "sudo ip addr add 192.168.1.2/24 dev ens3"
echo "sudo ip route add default via 192.168.1.1 dev ens3"
echo "ping 192.168.1.1"
echo ""
echo "PC2 (ens3)"
echo "--------------------------------------------"
echo "sudo ip addr flush dev ens3"
echo "sudo ip addr add 192.168.2.2/24 dev ens3"
echo "sudo ip route add default via 192.168.2.1 dev ens3"
echo "ping 192.168.2.1"
