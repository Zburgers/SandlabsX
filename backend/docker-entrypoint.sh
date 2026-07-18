#!/usr/bin/env bash
set -Eeuo pipefail

# LEGACY COMPATIBILITY ENTRYPOINT
#
# The default `legacy-l2` mode exists only to keep the pre-Capsule QemuManager
# usable while the new PlanCompiler allocations are connected to a real
# single-host runner. Do not add new topology behavior here.
#
# Removal condition:
# - Capsule/local runner creates and owns per-instance bridges and TAP devices.
# - Legacy node and lab start routes no longer depend on fixed tap0..tap3 names.
#
# Target replacement:
#   Capsule operation -> LocalRunner -> QemuNetworkService/QemuProcessService

log() {
  printf '[sandlabx-entrypoint] %s\n' "$*"
}

warn() {
  printf '[sandlabx-entrypoint] WARNING: %s\n' "$*" >&2
}

network_mode="${SANDLABX_NETWORK_MODE:-legacy-l2}"

case "$network_mode" in
  legacy-l2)
    log "Preparing container-local LEGACY Layer-2 bridges"
    if [[ ! -c /dev/net/tun ]]; then
      warn "/dev/net/tun is unavailable; the API can start, but legacy TAP-backed VMs will not"
    fi
    /usr/local/bin/setup-network.sh
    ;;
  disabled|plan-only)
    log "Skipping LEGACY bridge setup (SANDLABX_NETWORK_MODE=$network_mode)"
    ;;
  *)
    printf '[sandlabx-entrypoint] ERROR: unsupported SANDLABX_NETWORK_MODE=%s\n' "$network_mode" >&2
    exit 64
    ;;
esac

# LEGACY/OPTIONAL: image discovery used to run on every container boot. Keep it
# opt-in only until all image imports are handled asynchronously by ImagePipeline.
if [[ "${SANDLABX_VALIDATE_IMAGES_ON_STARTUP:-false}" == "true" ]]; then
  warn "LEGACY startup image validation is enabled and may delay readiness"
  /usr/local/bin/init-images.sh
else
  log "Skipping eager image validation; use the image CLI or make image-init explicitly"
fi

exec "$@"
