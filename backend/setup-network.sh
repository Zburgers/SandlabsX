#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${SANDLABX_ENABLE_LEGACY_NETWORK:-false}" != "true" ]]; then
  printf '[sandlabx-network] Legacy fixed bridge setup is quarantined. Capsule runner networking is compiled per instance.\n' >&2
  exit 64
fi

# LEGACY FIXED-TOPOLOGY NETWORK BOOTSTRAP
#
# Purpose today:
# - Keep the pre-Capsule QemuManager functional during the runner transition.
# - Create two unnumbered Layer-2 bridges inside the backend container only.
#
# This is NOT the target networking architecture. The target is the compiled
# Capsule network plan executed by an instance-aware QemuNetworkService. That
# service must create deterministic per-instance bridges/TAPs, persist ownership,
# and execute cleanup/compensation from the compiled plan.
#
# Removal condition:
# - Legacy /api/nodes and /api/labs start paths no longer use fixed tap0..tap3.
# - LocalRunner can execute PlanCompiler network allocations end to end.
#
# Do not add NAT, routes, IP addresses, forwarding, firewall rules, or new lab
# layouts here. Those belong in explicit runner operations with ownership data.

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
    log "Reusing existing LEGACY bridge $bridge"
  else
    log "Creating LEGACY bridge $bridge"
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

log "Preparing isolated LEGACY Layer-2 network inside the backend container"
for bridge in "${bridges[@]}"; do
  ensure_bridge "$bridge"
done

log "LEGACY bridges are ready"
log "  sandlabx-br0: router G0/0 and PC1 segment"
log "  sandlabx-br1: router G0/1 and PC2 segment"
log "No IP addresses, routes, NAT rules, or forwarding settings were changed"
