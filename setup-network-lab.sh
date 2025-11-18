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

# Function to configure a router
configure_router() {
    local node_id=$1
    local hostname=$2
    local if0_ip=$3
    local if0_mask=$4
    local if1_ip=$5
    local if1_mask=$6
    local routes=$7
    
    echo "🔧 Configuring router $hostname..."
    
    # Wait for router to boot (3 minutes for Cisco)
    echo "   ⏳ Waiting for router to boot (60 seconds)..."
    sleep 60
    
    # Build routes JSON array
    local routes_json="[]"
    if [ -n "$routes" ]; then
        routes_json="$routes"
    fi
    
    curl -sf -X POST "$API_BASE/nodes/$node_id/configure-router" \
        -H "Content-Type: application/json" \
        -d "{
            \"hostname\": \"$hostname\",
            \"enableSecret\": \"cisco123\",
            \"interface0\": {
                \"ip\": \"$if0_ip\",
                \"mask\": \"$if0_mask\"
            },
            \"interface1\": {
                \"ip\": \"$if1_ip\",
                \"mask\": \"$if1_mask\"
            },
            \"routes\": $routes_json
        }" > /dev/null
    
    echo "   ✅ Configuration sent"
}

# Wait for API
wait_for_api

echo ""
echo "🏗️  Creating nodes..."
echo ""

# Create Cisco Router
router_id=$(create_node "Router" "router" 1024 1)
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

# Start Router
start_node "$router_id" "Router"
echo "   ⏳ Router boot time: ~3 minutes"
sleep 5

# Start PC1
start_node "$pc1_id" "PC1"
sleep 5

# Start PC2
start_node "$pc2_id" "PC2"
sleep 5

echo ""
echo "⚙️  Configuring router..."
echo ""

# Configure Router
# GigabitEthernet0/0: 192.168.1.1 (connects to PC1)
# GigabitEthernet0/1: 192.168.2.1 (connects to PC2)
configure_router "$router_id" "Router" "192.168.1.1" "255.255.255.0" "192.168.2.1" "255.255.255.0" ""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ LAB SETUP COMPLETE!"
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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 NEXT STEPS - Configure PCs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click on PC1 → Click VNC/Desktop button → Connect via Guacamole"
echo "3. Login (default user: debian, no password or check cloud-init)"
echo "4. Open terminal and run:"
echo ""
echo "   PC1 Commands:"
echo "   -------------"
echo "   sudo ip addr add 192.168.1.2/24 dev eth0"
echo "   sudo ip link set eth0 up"
echo "   sudo ip route add default via 192.168.1.1"
echo "   ping 192.168.2.2  # Test connectivity to PC2"
echo ""
echo "5. Do the same for PC2:"
echo ""
echo "   PC2 Commands:"
echo "   -------------"
echo "   sudo ip addr add 192.168.2.2/24 dev eth0"
echo "   sudo ip link set eth0 up"
echo "   sudo ip route add default via 192.168.2.1"
echo "   ping 192.168.1.2  # Test connectivity to PC1"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Access Points"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001/api"
echo "   Guacamole: http://localhost:8081/guacamole"
echo "              (user: guacadmin, pass: guacadmin)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
