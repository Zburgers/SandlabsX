#!/bin/bash

# 🛑 SandBoxLabs - Stop All Services
# This script stops EVERYTHING: Frontend + Backend + Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================================="
echo "  🛑 SandBoxLabs - Stopping All Services"
echo "=================================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}⚠${NC}  $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }

# Stop Frontend
if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    info "Stopping Frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    rm frontend.pid
    success "Frontend stopped"
else
    info "Frontend not running (no PID file)"
    pkill -f "next dev" 2>/dev/null || true
fi

# Stop Backend
if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    info "Stopping Backend API (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
    pkill -f "node.*server.js" 2>/dev/null || true
    rm backend.pid
    success "Backend stopped"
else
    info "Backend not running (no PID file)"
    pkill -f "node.*server.js" 2>/dev/null || true
fi

# Stop Docker services
info "Stopping Docker services..."
docker-compose down

success "Docker services stopped"

echo ""
echo "=================================================================="
echo "  ✅ ALL SERVICES STOPPED"
echo "=================================================================="
echo ""
echo "To start again, run: ./run-all.sh"
echo ""
