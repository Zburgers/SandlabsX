#!/bin/bash

echo "========================================="
echo "  KVM Access Test for Docker Container"
echo "========================================="
echo ""

echo "1️⃣ Checking host /dev/kvm..."
if [ -e /dev/kvm ]; then
    ls -l /dev/kvm
    echo "✅ Host has KVM device"
else
    echo "❌ Host does NOT have KVM device"
    exit 1
fi
echo ""

echo "2️⃣ Checking if backend container is running..."
if docker ps | grep -q sandlabx-backend; then
    echo "✅ Backend container is running"
else
    echo "❌ Backend container is NOT running"
    echo "   Run: docker-compose up -d"
    exit 1
fi
echo ""

echo "3️⃣ Checking KVM access inside container..."
if docker exec sandlabx-backend ls /dev/kvm &>/dev/null; then
    docker exec sandlabx-backend ls -l /dev/kvm
    echo "✅ Container HAS access to /dev/kvm"
else
    echo "❌ Container does NOT have access to /dev/kvm"
    echo "   Fix: docker-compose down && docker-compose up -d"
    exit 1
fi
echo ""

echo "4️⃣ Checking QEMU installation in container..."
if docker exec sandlabx-backend which qemu-system-x86_64 &>/dev/null; then
    echo "✅ QEMU is installed"
else
    echo "❌ QEMU is NOT installed"
    exit 1
fi
echo ""

echo "========================================="
echo "  ✅ All checks passed!"
echo "  Router should now boot with KVM"
echo "========================================="
