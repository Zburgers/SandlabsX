#!/bin/bash
# Test Bazzite VM with Guacamole after installation

echo "=== Bazzite VM Test ==="

# Stop the installation VM
echo "1. Stopping installation VM..."
pkill -f "bazzite.*iso"

# Start services
echo "2. Starting Docker services..."
cd /home/naki/Desktop/itsthatnewshit/sandboxlabs
docker compose up -d

sleep 5

# Create Bazzite node via API
echo "3. Creating Bazzite node..."
curl -X POST http://localhost:3001/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"name":"bazzite-test","osType":"bazzite","resources":{"memory":"4096","cpus":"2"}}'

echo ""
echo "4. Listing nodes..."
curl -s http://localhost:3001/api/nodes | jq .

echo ""
echo "=== Next Steps ==="
echo "1. Find your node ID from the list above"
echo "2. Run the node: curl -X POST http://localhost:3001/api/nodes/YOUR_NODE_ID/run"
echo "3. Access Guacamole: http://localhost:8081/guacamole"
