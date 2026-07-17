#!/usr/bin/env bash
set -Eeuo pipefail

# LEGACY HOST RUNTIME — NOT THE TARGET ARCHITECTURE
#
# This mode stops the Compose backend and runs QEMU plus the API directly in the
# host network namespace. It is retained only for diagnosing environments where
# nested/containerized KVM is unavailable. It is intentionally disabled by
# default because host bridge/TAP changes have a larger blast radius.
#
# Target replacement:
#   dedicated single-host runner executing compiled Capsule plans with durable
#   ownership and reconciliation.
#
# Remove this script once the LocalRunner supports real QEMU/network execution.

if [[ "${SANDLABX_ENABLE_LEGACY_HOST_RUNTIME:-false}" != "true" ]]; then
  cat >&2 <<'EOF'
Refusing to start the LEGACY host runtime.

Use the normal container runtime:
  make rebuild

For an intentional diagnostic run, review this script and set both:
  SANDLABX_ENABLE_LEGACY_HOST_RUNTIME=true
  SANDLABX_ALLOW_HOST_NETWORK_SETUP=true
EOF
  exit 64
fi

if [[ "${SANDLABX_ALLOW_HOST_NETWORK_SETUP:-false}" != "true" ]]; then
  printf 'SANDLABX_ALLOW_HOST_NETWORK_SETUP=true is also required.\n' >&2
  exit 64
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

printf 'WARNING: starting LEGACY host runtime; host network changes are explicitly enabled.\n'

docker compose stop backend

cd backend
npm install --no-audit --no-fund

sudo --preserve-env=SANDLABX_ALLOW_HOST_NETWORK_SETUP \
  env SANDLABX_ALLOW_HOST_NETWORK_SETUP=true ./setup-network.sh

chmod 0755 "$ROOT_DIR/backend/qemu-ifup" "$ROOT_DIR/backend/qemu-ifdown"

export DATABASE_URL="postgresql://${POSTGRES_USER:-guacamole_user}:${POSTGRES_PASSWORD:-guacamole_pass}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-guacamole_db}"
export GUAC_BASE_URL="http://localhost:${GUACAMOLE_PORT:-8081}/guacamole"
export DB_HOST="localhost"
export DB_PORT="${POSTGRES_PORT:-5432}"
export DB_NAME="${POSTGRES_DB:-guacamole_db}"
export DB_USER="${POSTGRES_USER:-guacamole_user}"
export DB_PASSWORD="${POSTGRES_PASSWORD:-guacamole_pass}"
export BASE_IMAGE_PATH="../images/ubuntu-24-lts.qcow2"
export CUSTOM_IMAGES_PATH="../images/custom"
export IMAGE_CATALOG_PATH="../images/catalog.json"
export OVERLAYS_PATH="../overlays"
export VMS_PATH="../vms"
export CHECKPOINTS_PATH="../checkpoints"
export QEMU_IFUP="$ROOT_DIR/backend/qemu-ifup"
export QEMU_IFDOWN="$ROOT_DIR/backend/qemu-ifdown"

exec npm start
