#!/bin/bash

# PC1 Network Connectivity Test Script
# Network Topology:
#   PC1 (192.168.1.10/24) <--> Bridge (192.168.1.1) <--> PC2 (192.168.1.20/24)
#   Router has two interfaces on the same bridge for now

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 PC1 Network Connectivity Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configure PC1 network interface
echo "🔧 Configuring PC1 network interface..."
ip addr flush dev ens3 2>/dev/null
ip addr add 192.168.1.10/24 dev ens3
ip link set ens3 up
ip route add default via 192.168.1.1 2>/dev/null

echo "✅ PC1 configured with IP: 192.168.1.10/24"
echo ""

# Show interface configuration
echo "📋 Interface Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ip addr show ens3 | grep -E "inet |link/ether"
echo ""

# Show routing table
echo "📋 Routing Table:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ip route
echo ""

# Test 1: Ping localhost
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Localhost (127.0.0.1)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ping -c 3 -W 2 127.0.0.1 > /dev/null 2>&1; then
    echo "✅ Localhost: OK"
else
    echo "❌ Localhost: FAILED"
fi
echo ""

# Test 2: Ping self
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Self (192.168.1.10)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ping -c 3 -W 2 192.168.1.10 > /dev/null 2>&1; then
    echo "✅ Self ping: OK"
else
    echo "❌ Self ping: FAILED"
fi
echo ""

# Test 3: Ping bridge
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Bridge (192.168.1.1)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ping -c 4 -W 2 192.168.1.1 > /dev/null 2>&1; then
    echo "✅ Bridge: OK"
    ping -c 4 192.168.1.1 | tail -3
else
    echo "❌ Bridge: FAILED"
    echo "   Cannot reach default gateway"
fi
echo ""

# Test 4: Ping PC2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: PC2 (192.168.1.20)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ping -c 4 -W 2 192.168.1.20 > /dev/null 2>&1; then
    echo "✅ PC2: OK"
    ping -c 4 192.168.1.20 | tail -3
else
    echo "❌ PC2: FAILED"
    echo "   PC2 may not be configured or running"
    echo "   Expected IP: 192.168.1.20"
fi
echo ""

# Test 5: ARP table
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: ARP Table (neighbor discovery)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Known neighbors:"
ip neigh show | grep -v FAILED
echo ""

# Test 6: DNS resolution (if configured)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: DNS Resolution"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f /etc/resolv.conf ]; then
    echo "DNS servers configured:"
    cat /etc/resolv.conf | grep nameserver
else
    echo "⚠️  No DNS configured (/etc/resolv.conf not found)"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Network Configuration:"
echo "  • PC1 IP:      192.168.1.10/24"
echo "  • Gateway:     192.168.1.1 (Bridge)"
echo "  • PC2 IP:      192.168.1.20/24"
echo ""
echo "Connectivity Status:"

# Check each target
passed=0
failed=0

ping -c 1 -W 1 127.0.0.1 > /dev/null 2>&1 && { echo "  ✅ Localhost"; ((passed++)); } || { echo "  ❌ Localhost"; ((failed++)); }
ping -c 1 -W 1 192.168.1.10 > /dev/null 2>&1 && { echo "  ✅ Self (192.168.1.10)"; ((passed++)); } || { echo "  ❌ Self (192.168.1.10)"; ((failed++)); }
ping -c 1 -W 1 192.168.1.1 > /dev/null 2>&1 && { echo "  ✅ Bridge (192.168.1.1)"; ((passed++)); } || { echo "  ❌ Bridge (192.168.1.1)"; ((failed++)); }
ping -c 1 -W 1 192.168.1.20 > /dev/null 2>&1 && { echo "  ✅ PC2 (192.168.1.20)"; ((passed++)); } || { echo "  ❌ PC2 (192.168.1.20)"; ((failed++)); }

echo ""
echo "Results: $passed passed, $failed failed"
echo ""

if [ $failed -eq 0 ]; then
    echo "🎉 All tests passed! Network is fully operational."
else
    echo "⚠️  Some tests failed. Check network configuration."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
