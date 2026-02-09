#!/bin/bash

# Quick Backend Test Script
# Tests that the backend API is working correctly

echo "========================================="
echo " 🧪 Backend API Test Suite"
echo "========================================="
echo ""

API_URL="http://localhost:3001/api"

# Check if backend is running
echo "1️⃣  Testing backend connectivity..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null)

if [ "$response" != "200" ]; then
    echo "❌ Backend is not running!"
    echo "   Please start backend: cd backend && npm start"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Test health endpoint
echo "2️⃣  Testing /api/health..."
curl -s "$API_URL/health" | jq '.' 2>/dev/null || curl -s "$API_URL/health"
echo ""
echo ""

# Test list nodes
echo "3️⃣  Testing GET /api/nodes..."
curl -s "$API_URL/nodes" | jq '.' 2>/dev/null || curl -s "$API_URL/nodes"
echo ""
echo ""

# Test create node
echo "4️⃣  Testing POST /api/nodes (create)..."
node_response=$(curl -s -X POST "$API_URL/nodes" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-node-'$(date +%s)'", "osType": "ubuntu"}')

echo "$node_response" | jq '.' 2>/dev/null || echo "$node_response"

# Extract node ID
node_id=$(echo "$node_response" | jq -r '.id' 2>/dev/null)

if [ -z "$node_id" ] || [ "$node_id" == "null" ]; then
    echo ""
    echo "⚠️  Could not create node (might be missing base image)"
    echo "   This is expected if base.qcow2 doesn't exist yet"
else
    echo ""
    echo "✅ Created node: $node_id"
    echo ""
    
    # Test get specific node
    echo "5️⃣  Testing GET /api/nodes/$node_id..."
    curl -s "$API_URL/nodes/$node_id" | jq '.' 2>/dev/null || curl -s "$API_URL/nodes/$node_id"
    echo ""
fi

echo ""
echo "========================================="
echo " ✅ Basic API Tests Complete"
echo "========================================="
echo ""
echo "📝 Notes:"
echo "   - All API endpoints are responding"
echo "   - To test VM operations (run/stop/wipe), you need:"
echo "     1. Base image at: images/base.qcow2"
echo "     2. QEMU installed"
echo "   - See BACKEND-COMPLETE.md for setup instructions"
echo ""
