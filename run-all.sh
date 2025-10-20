#!/bin/bash

# 🚀 SandBoxLabs - ONE COMMAND TO RULE THEM ALL
# This script starts EVERYTHING: Docker + Backend + Frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================================="
echo "  🚀 SandBoxLabs - Complete System Startup"
echo "=================================================================="
echo ""
echo "Starting all services in one command..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
info() { echo -e "${BLUE}ℹ${NC}  $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}❌${NC} $1"; }

# Check prerequisites
info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    error "Docker is not installed!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed!"
    exit 1
fi

if ! command -v node &> /dev/null; then
    error "Node.js is not installed!"
    exit 1
fi

success "Prerequisites check passed"
echo ""

# Step 1: Setup dependencies (if needed)
info "Step 1/4: Setting up dependencies..."

if [ ! -d "backend/node_modules" ]; then
    info "Installing backend dependencies..."
    cd backend
    npm install --silent
    cd ..
    success "Backend dependencies installed"
else
    success "Backend dependencies already installed"
fi

if [ ! -d "frontend/node_modules" ]; then
    info "Installing frontend dependencies..."
    cd frontend
    npm install --silent
    cd ..
    success "Frontend dependencies installed"
else
    success "Frontend dependencies already installed"
fi

echo ""

# Step 2: Start Docker services
info "Step 2/4: Starting Docker services (Guacamole, PostgreSQL, Guacd)..."
docker-compose up -d

echo ""
info "Waiting for Docker services to be healthy (10 seconds)..."
sleep 10
success "Docker services started"
echo ""

# Step 3: Start Backend in background
info "Step 3/4: Starting Backend API server..."

# Kill any existing backend process
pkill -f "node.*server.js" 2>/dev/null || true

cd backend
nohup node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    success "Backend API started (PID: $BACKEND_PID)"
    echo "$BACKEND_PID" > backend.pid
else
    error "Failed to start backend!"
    error "Check backend.log for details"
    exit 1
fi

echo ""

# Step 4: Start Frontend in background
info "Step 4/4: Starting Frontend development server..."

# Kill any existing frontend process
pkill -f "next dev" 2>/dev/null || true

cd frontend
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 5

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    success "Frontend started (PID: $FRONTEND_PID)"
    echo "$FRONTEND_PID" > frontend.pid
else
    error "Failed to start frontend!"
    error "Check frontend.log for details"
    exit 1
fi

echo ""
echo "=================================================================="
echo "  ✅ ALL SERVICES STARTED SUCCESSFULLY!"
echo "=================================================================="
echo ""
echo "🌐 Access your application:"
echo ""
echo "   Frontend UI:    http://localhost:3000"
echo "   Backend API:    http://localhost:3001/api"
echo "   API Health:     http://localhost:3001/api/health"
echo "   Guacamole:      http://localhost:8081/guacamole"
echo "                   (Login: guacadmin / guacadmin)"
echo ""
echo "=================================================================="
echo ""
echo "📊 Service Status:"
echo ""
echo "   ✅ Docker Services: Running"
docker-compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker-compose ps
echo ""
echo "   ✅ Backend API:     Running (PID: $BACKEND_PID)"
echo "   ✅ Frontend:        Running (PID: $FRONTEND_PID)"
echo ""
echo "=================================================================="
echo ""
echo "📝 Logs:"
echo ""
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo "   Docker:   docker-compose logs -f"
echo ""
echo "=================================================================="
echo ""
echo "🛑 To stop all services, run:"
echo ""
echo "   ./stop-all.sh"
echo ""
echo "=================================================================="
echo ""
echo "🎉 System is ready! Open http://localhost:3000 in your browser"
echo ""
