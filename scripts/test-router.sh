#!/bin/bash
# Quick test script to create a Cisco router node

echo "🧪 Creating Cisco Router Node..."

curl -X POST http://localhost:3001/api/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cisco-router-1",
    "osType": "custom",
    "imageType": "custom",
    "customImageName": "router_1762805489189.qcow2",
    "resources": {
      "ram": 256,
      "cpus": 1
    }
  }' | jq '.'

echo ""
echo "✅ Router node created!"
echo ""
echo "📋 Next Steps:"
echo "  1. Open http://localhost:3000"
echo "  2. Find the 'cisco-router-1' node"
echo "  3. Click the node card to open it"
echo "  4. IGNORE the VNC viewer (will be blank - this is correct!)"
echo "  5. Click 'Open Serial Console' button"
echo "  6. Wait 30-60 seconds for router to boot"
echo "  7. You should see 'Router>' prompt"
echo ""
echo "🔧 Router Configuration Commands:"
echo "  enable"
echo "  show version"
echo "  show ip interface brief"
echo ""
