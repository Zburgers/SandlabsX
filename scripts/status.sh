#!/bin/bash

# 📊 SandBoxLabs - Check Status of All Services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================================="
echo "  📊 SandBoxLabs - Service Status"
echo "=================================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

running() { echo -e "${GREEN}✅ RUNNING${NC}"; }
stopped() { echo -e "${RED}❌ STOPPED${NC}"; }
unknown() { echo -e "${YELLOW}⚠  UNKNOWN${NC}"; }

# Check Docker services
echo "🐳 Docker Services:"
echo ""
if docker-compose ps | grep -q "Up"; then
    docker-compose ps
else
    echo "   ❌ Docker services are not running"
    echo "   Start with: docker-compose up -d"
fi
echo ""

# Check Backend
echo "🔧 Backend API (Port 3001):"
if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo -n "   Status: "
        running
        echo "   PID: $BACKEND_PID"
        echo "   URL: http://localhost:3001/api"
        
        # Test if responding
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            echo "   Health: ✅ Responding"
        else
            echo "   Health: ⚠️  Not responding (still starting?)"
        fi
    else
        echo -n "   Status: "
        stopped
        echo "   (PID file exists but process is dead)"
    fi
else
    echo -n "   Status: "
    stopped
    echo "   (No PID file found)"
fi
echo ""

# Check Frontend
echo "🎨 Frontend (Port 3000):"
if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -n "   Status: "
        running
        echo "   PID: $FRONTEND_PID"
        echo "   URL: http://localhost:3000"
        
        # Test if responding
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "   Health: ✅ Responding"
        else
            echo "   Health: ⚠️  Not responding (still starting?)"
        fi
    else
        echo -n "   Status: "
        stopped
        echo "   (PID file exists but process is dead)"
    fi
else
    echo -n "   Status: "
    stopped
    echo "   (No PID file found)"
fi
echo ""

# Check Guacamole
echo "🖥️  Guacamole (Port 8081):"
if curl -s http://localhost:8081/guacamole/ > /dev/null 2>&1; then
    echo -n "   Status: "
    running
    echo "   URL: http://localhost:8081/guacamole"
    echo "   Login: guacadmin / guacadmin"
else
    echo -n "   Status: "
    stopped
fi
echo ""

echo "=================================================================="
echo ""
echo "📝 Quick Commands:"
echo ""
echo "   View Backend Logs:  tail -f backend.log"
echo "   View Frontend Logs: tail -f frontend.log"
echo "   View Docker Logs:   docker-compose logs -f"
echo ""
echo "   Test Backend API:   curl http://localhost:3001/api/health"
echo "   Open Frontend:      xdg-open http://localhost:3000"
echo "   Open Guacamole:     xdg-open http://localhost:8081/guacamole"
echo ""
echo "   Stop All Services:  ./stop-all.sh"
echo "   Start All Services: ./run-all.sh"
echo ""
echo "=================================================================="
