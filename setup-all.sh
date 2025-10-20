#!/bin/bash

# SandBoxLabs - Complete System Startup
# This script starts all services: Docker Compose + Backend API + Frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo " 🚀 SandBoxLabs - Complete Startup"
echo "========================================="
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Check Docker
if ! command_exists docker; then
    echo "❌ Error: Docker is not installed"
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Error: Docker Compose is not installed"
    exit 1
fi

# Check Node.js
if ! command_exists node; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# 1. Start Docker services
echo "1️⃣  Starting Docker services (Guacamole, PostgreSQL, Guacd)..."
docker-compose up -d

echo "   Waiting for services to be healthy..."
sleep 5

# 2. Setup backend
echo ""
echo "2️⃣  Setting up backend..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "   Installing backend dependencies..."
    npm install
fi

# 3. Setup frontend
echo ""
echo "3️⃣  Setting up frontend..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "   Installing frontend dependencies..."
    npm install
fi

cd ..

echo ""
echo "========================================="
echo " ✅ Setup Complete!"
echo "========================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Start Backend API (Terminal 1):"
echo "   cd backend && npm start"
echo ""
echo "2. Start Frontend (Terminal 2):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Access the application:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001/api"
echo "   Guacamole: http://localhost:8081/guacamole"
echo ""
echo "========================================="
echo ""
echo "💡 Tip: Use 'docker-compose logs -f' to view Docker logs"
echo ""
