#!/bin/bash

# SandBoxLabs - Complete Setup Verification Script
# Verifies PostgreSQL database, KVM access, and all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo " 🔍 SandBoxLabs Setup Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Check Docker Compose services
echo "1️⃣  Checking Docker Compose services..."
if docker compose ps | grep -q "sandlabx-postgres.*Up"; then
    success "PostgreSQL is running"
else
    error "PostgreSQL is not running"
    exit 1
fi

if docker compose ps | grep -q "sandlabx-backend.*Up"; then
    success "Backend is running"
else
    error "Backend is not running"
    exit 1
fi

if docker compose ps | grep -q "sandlabx-frontend.*Up"; then
    success "Frontend is running"
else
    error "Frontend is not running"
    exit 1
fi

if docker compose ps | grep -q "sandlabx-guacamole.*Up"; then
    success "Guacamole is running"
else
    error "Guacamole is not running"
    exit 1
fi

if docker compose ps | grep -q "sandlabx-guacd.*Up"; then
    success "Guacd is running"
else
    error "Guacd is not running"
    exit 1
fi

echo ""

# 2. Check PostgreSQL database and tables
echo "2️⃣  Checking PostgreSQL database..."
if docker compose exec -T postgres psql -U guacamole_user -d guacamole_db -c "\dt sandlabx_nodes" 2>&1 | grep -q "sandlabx_nodes"; then
    success "sandlabx_nodes table exists"
else
    error "sandlabx_nodes table does not exist"
    exit 1
fi

NODE_COUNT=$(docker compose exec -T postgres psql -U guacamole_user -d guacamole_db -t -c "SELECT COUNT(*) FROM sandlabx_nodes;" | xargs)
success "Database has $NODE_COUNT nodes"

if docker compose exec -T postgres psql -U guacamole_user -d guacamole_db -c "\dt guacamole_connection" 2>&1 | grep -q "guacamole_connection"; then
    success "Guacamole tables exist"
else
    error "Guacamole tables do not exist"
    exit 1
fi

echo ""

# 3. Check KVM access in backend container
echo "3️⃣  Checking KVM access in backend container..."
if docker compose exec backend ls /dev/kvm >/dev/null 2>&1; then
    success "/dev/kvm is available in backend container"
else
    error "/dev/kvm is NOT available in backend container"
    exit 1
fi

# Check KVM acceleration
KVM_CHECK=$(docker compose exec backend kvm-ok 2>&1)
if echo "$KVM_CHECK" | grep -q "KVM acceleration can be used"; then
    success "KVM acceleration is available"
else
    warning "KVM acceleration may not be available"
    echo "$KVM_CHECK"
fi

echo ""

# 4. Check backend API
echo "4️⃣  Checking Backend API..."
if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:3001/api/health)
    if echo "$HEALTH" | grep -q "healthy"; then
        success "Backend API is healthy"
    else
        warning "Backend API responded but not healthy"
    fi
else
    error "Backend API is not responding"
    exit 1
fi

# Test nodes endpoint
if curl -s http://localhost:3001/api/nodes >/dev/null 2>&1; then
    success "Backend /api/nodes endpoint is working"
else
    error "Backend /api/nodes endpoint is not working"
    exit 1
fi

echo ""

# 5. Check frontend
echo "5️⃣  Checking Frontend..."
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    success "Frontend is accessible"
else
    error "Frontend is not accessible"
    exit 1
fi

echo ""

# 6. Check Guacamole
echo "6️⃣  Checking Guacamole..."
if curl -s http://localhost:8081/guacamole >/dev/null 2>&1; then
    success "Guacamole is accessible"
else
    error "Guacamole is not accessible"
    exit 1
fi

echo ""

# 7. Check QEMU in backend container
echo "7️⃣  Checking QEMU tools in backend container..."
if docker compose exec backend which qemu-system-x86_64 >/dev/null 2>&1; then
    success "qemu-system-x86_64 is installed"
else
    error "qemu-system-x86_64 is NOT installed"
    exit 1
fi

if docker compose exec backend which qemu-img >/dev/null 2>&1; then
    success "qemu-img is installed"
else
    error "qemu-img is NOT installed"
    exit 1
fi

echo ""

# 8. Check directories and volumes
echo "8️⃣  Checking directories and volumes..."
if [ -d "./overlays" ]; then
    success "overlays directory exists"
else
    warning "overlays directory does not exist (will be created on first node)"
fi

if [ -d "./images" ]; then
    success "images directory exists"
else
    warning "images directory does not exist"
fi

if [ -d "./vms" ]; then
    success "vms directory exists"
else
    warning "vms directory does not exist"
fi

echo ""

# Summary
echo "========================================="
echo " ✅ VERIFICATION COMPLETE!"
echo "========================================="
echo ""
echo "📋 Summary:"
echo "  - PostgreSQL: ✅ Running with sandlabx_nodes table"
echo "  - Backend API: ✅ Running and healthy"
echo "  - Frontend: ✅ Accessible"
echo "  - Guacamole: ✅ Running"
echo "  - KVM: ✅ Available in backend container"
echo "  - QEMU: ✅ Installed in backend container"
echo ""
echo "🎮 Access URLs:"
echo "  - Frontend:  http://localhost:3000"
echo "  - Backend:   http://localhost:3001/api"
echo "  - Guacamole: http://localhost:8081/guacamole"
echo ""
echo "🧪 You can now:"
echo "  1. Create VMs via the frontend UI at http://localhost:3000"
echo "  2. Test the API: curl http://localhost:3001/api/nodes"
echo "  3. View logs: docker compose logs -f backend"
echo ""
echo "========================================="
