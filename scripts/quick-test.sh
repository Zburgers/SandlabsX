#!/bin/bash
# Quick test to verify everything is working

echo "Testing Backend API..."
curl -s http://localhost:3001/api/health | jq '.' 2>/dev/null || echo "Backend not responding"

echo ""
echo "Testing Frontend..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000

echo ""
echo "Testing Guacamole..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8081/guacamole/

echo ""
echo "Creating test node..."
curl -s -X POST http://localhost:3001/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"name":"test-node"}' | jq '.' 2>/dev/null || echo "Failed to create node"

echo ""
echo "Listing nodes..."
curl -s http://localhost:3001/api/nodes | jq '.' 2>/dev/null || echo "Failed to list nodes"
