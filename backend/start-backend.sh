#!/bin/bash

# SandBoxLabs - Start Backend API Server
# This script starts the Node.js backend API server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo " SandBoxLabs Backend API Server"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  Warning: .env file not found"
    echo "   Using default configuration"
fi

# Check if QEMU is installed
if ! command -v qemu-system-x86_64 &> /dev/null; then
    echo ""
    echo "⚠️  Warning: QEMU is not installed"
    echo "   VMs will not be able to start"
    echo "   Install: sudo apt-get install qemu-system-x86 qemu-utils"
fi

echo ""
echo "🚀 Starting backend server..."
echo "   Press Ctrl+C to stop"
echo ""
echo "========================================="
echo ""

# Start the server
npm start
