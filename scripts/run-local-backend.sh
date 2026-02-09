#!/bin/bash
set -e

echo "🔄 Switching to Host-Based QEMU Mode..."

# 1. Stop the Dockerized backend (but keep DB and Guacamole running)
echo "🐳 Stopping Docker backend..."
docker compose stop backend

# 2. Ensure dependencies are installed
echo "📦 Installing Node.js dependencies..."
cd backend
npm install

# 3. Setup Local Network Bridges (Requires sudo)
echo "🌉 Setting up local network bridges (sudo required)..."
sudo ./setup-network.sh

# 4. Start Backend Locally
echo "🚀 Starting Backend on Host..."
echo "   (Connecting to Dockerized Postgres & Guacamole)"

# Environment variables to connect to Docker services from Host
export DATABASE_URL="postgresql://guacamole_user:guacamole_pass@localhost:5432/guacamole_db"
export GUAC_BASE_URL="http://localhost:8081/guacamole"
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="guacamole_db"
export DB_USER="guacamole_user"
export DB_PASSWORD="guacamole_pass"

# Paths (Relative to backend/ directory)
export BASE_IMAGE_PATH="../images/ubuntu-24-lts.qcow2"
export CUSTOM_IMAGES_PATH="../images/custom"
export OVERLAYS_PATH="../overlays"
export VMS_PATH="../vms"

# Run!
npm start
