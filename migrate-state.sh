#!/bin/bash

# Migration script for VM state persistence
# This script migrates the old state file to the new persistent location

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo " VM State Migration Script"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}ℹ${NC}  $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}❌${NC} $1"; }

# Check if old state file exists
OLD_STATE_FILE="backend/nodes-state.json"

if [ ! -f "$OLD_STATE_FILE" ]; then
    warning "No old state file found at $OLD_STATE_FILE"
    info "This is normal for fresh installations"
    exit 0
fi

info "Found old state file: $OLD_STATE_FILE"

# Check if container is running
if ! docker ps | grep -q sandlabx-backend; then
    error "Backend container is not running"
    echo ""
    echo "Please start the backend first:"
    echo "  docker compose up -d backend"
    exit 1
fi

success "Backend container is running"

# Count nodes in old state
NODE_COUNT=$(cat "$OLD_STATE_FILE" | jq -r '.nodes | length' 2>/dev/null || echo "0")
info "Found $NODE_COUNT node(s) in old state file"

if [ "$NODE_COUNT" -eq 0 ]; then
    warning "No nodes to migrate"
    exit 0
fi

echo ""
echo "Nodes to migrate:"
cat "$OLD_STATE_FILE" | jq -r '.nodes[] | "  - \(.name) (\(.osType)) - \(.status)"'
echo ""

# Ask for confirmation
read -p "Do you want to migrate these nodes? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    warning "Migration cancelled"
    exit 0
fi

# Create backup of old file
BACKUP_FILE="backend/nodes-state.json.backup.$(date +%Y%m%d_%H%M%S)"
cp "$OLD_STATE_FILE" "$BACKUP_FILE"
success "Created backup: $BACKUP_FILE"

# Copy state file to container
info "Migrating state file to persistent storage..."
docker cp "$OLD_STATE_FILE" sandlabx-backend:/app/state/nodes-state.json

if [ $? -eq 0 ]; then
    success "State file migrated successfully"
else
    error "Failed to migrate state file"
    exit 1
fi

# Restart backend to load new state
info "Restarting backend to load migrated state..."
docker compose restart backend > /dev/null 2>&1

# Wait for backend to be ready
info "Waiting for backend to be ready..."
sleep 5

# Verify migration
MIGRATED_COUNT=$(curl -s http://localhost:3001/api/nodes 2>/dev/null | jq -r '.count' 2>/dev/null || echo "0")

if [ "$MIGRATED_COUNT" -eq "$NODE_COUNT" ]; then
    success "Migration successful! $MIGRATED_COUNT node(s) loaded"
    echo ""
    echo "Your VMs have been migrated to persistent storage."
    echo "They will now survive container restarts and docker compose down/up cycles."
else
    warning "Migration verification failed"
    echo "Expected $NODE_COUNT nodes, but API reports $MIGRATED_COUNT"
    echo "Please check the backend logs:"
    echo "  docker compose logs backend"
fi

echo ""
echo "========================================="
echo " Migration Complete"
echo "========================================="
echo ""
echo "You can now safely delete the old state file:"
echo "  rm $OLD_STATE_FILE"
echo ""
echo "A backup was saved at:"
echo "  $BACKUP_FILE"
echo ""
