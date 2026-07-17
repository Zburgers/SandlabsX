#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[sandlabx-entrypoint] %s\n' "$*"
}

warn() {
  printf '[sandlabx-entrypoint] WARNING: %s\n' "$*" >&2
}

network_mode="${SANDLABX_NETWORK_MODE:-legacy-l2}"

case "$network_mode" in
  legacy-l2)
    log "Preparing container-local legacy Layer-2 bridges"
    if [[ ! -c /dev/net/tun ]]; then
      warn "/dev/net/tun is unavailable; the API can start, but legacy TAP-backed VMs will not"
    fi
    /usr/local/bin/setup-network.sh
    ;;
  disabled|plan-only)
    log "Skipping legacy bridge setup (SANDLABX_NETWORK_MODE=$network_mode)"
    ;;
  *)
    printf '[sandlabx-entrypoint] ERROR: unsupported SANDLABX_NETWORK_MODE=%s\n' "$network_mode" >&2
    exit 64
    ;;
esac

if [[ "${SANDLABX_VALIDATE_IMAGES_ON_STARTUP:-false}" == "true" ]]; then
  warn "Startup image validation is enabled and may delay readiness"
  /usr/local/bin/init-images.sh
else
  log "Skipping eager image validation; use the image CLI or make image-init explicitly"
fi

exec "$@"
