#!/bin/bash
set -e

echo "🛑 Stopping all containers..."
docker compose down

echo "🔨 Rebuilding backend container..."
echo "   (This ensures the latest code and configurations are included)"
docker compose build backend

echo "🚀 Starting containers..."
docker compose up -d

echo "🔍 Verifying KVM access inside container..."
if docker exec sandlabx-backend ls -la /dev/kvm > /dev/null 2>&1; then
    echo "✅ KVM is accessible inside the container!"
    docker exec sandlabx-backend ls -la /dev/kvm
else
    echo "❌ KVM is STILL NOT accessible inside the container."
    echo "   This usually means Docker Desktop is not configured correctly"
    echo "   or the host /dev/kvm permissions are restricted."
fi
