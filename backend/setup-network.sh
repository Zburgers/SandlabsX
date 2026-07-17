#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[sandlabx-network] %s\n' "$*"
}

fail() {
  printf '[sandlabx-network] ERROR: %s\n' "$*" >&2
  exit 1
}

# This script is intentionally limited to the backend container network namespace.
# Running the old implementation with sudo on the host could create conflicting
# 192.168.x.x routes and interfere with an existing LAN, VPN, or Docker network.
if [[ "${SANDLABX_ALLOW_HOST_NETWORK_SETUP:-false}" != "true" ]]; then
  if [[ ! -f /.dockerenv ]] && ! grep -qaE '(docker|containerd|kubepods|podman)' /proc/1/cgroup 2>/dev/null; then
    fail "refusing to modify the host network namespace; run the Docker backend or explicitly set SANDLABX_ALLOW_HOST_NETWORK_SETUP=true"
  fi
fi

command -v ip >/dev/null 2>&1 || fail "iproute2 is required"

bridges=(sandlabx-br0 sandlabx-br1)

ensure_bridge() {
  local bridge="$1"

  [[ "$bridge" =~ ^[a-zA-Z0-9_.-]{1,15}$ ]] || fail "invalid bridge name: $bridge"

  if ip link show "$bridge" >/dev/null 2>&1; then
    if ! ip -d link show "$bridge" | grep -q 'bridge'; then
      fail "interface $bridge already exists but is not a Linux bridge"
    fi
    log "Reusing existing bridge $bridge"
  else
    log "Creating bridge $bridge"
    ip link add name "$bridge" type bridge
  fi

  # Lab bridges are pure Layer-2 segments. They deliberately have no host/container
  # IP address and do not require IP forwarding. This prevents the infrastructure
  # namespace from impersonating the router VM or bypassing the routed topology.
  if ip -o -4 addr show dev "$bridge" scope global | grep -q .; then
    fail "bridge $bridge has an unexpected IPv4 address; refusing to alter it automatically"
  fi

  if ip -o -6 addr show dev "$bridge" scope global | grep -q .; then
    fail "bridge $bridge has an unexpected global IPv6 address; refusing to alter it automatically"
  fi

  ip link set "$bridge" up
}

log "Preparing isolated legacy Layer-2 network inside the backend container"
for bridge in "${bridges[@]}"; do
  ensure_bridge "$bridge"
done

log "Legacy bridges are ready"
log "  sandlabx-br0: router G0/0 and PC1 segment"
log "  sandlabx-br1: router G0/1 and PC2 segment"
log "No IP addresses, routes, NAT rules, or forwarding settings were changed"
