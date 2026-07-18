#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only host safety audit.
# This script never creates, deletes, addresses, or reconfigures an interface.

printf 'SandLabX host network audit (read only)\n'
printf '=======================================\n'

if ! command -v ip >/dev/null 2>&1; then
  printf 'iproute2 is unavailable; cannot inspect host interfaces.\n' >&2
  exit 127
fi

found=false
for bridge in sandlabx-br0 sandlabx-br1; do
  if ip link show "$bridge" >/dev/null 2>&1; then
    found=true
    printf '\nFound host interface %s:\n' "$bridge"
    ip -d link show "$bridge"
    ip addr show dev "$bridge"
  fi
done

if [[ "$found" == false ]]; then
  printf '\nNo legacy SandLabX bridge names exist in the host namespace.\n'
else
  cat <<'EOF'

WARNING: legacy SandLabX bridges exist on the host.
The optimized Compose startup does not create or modify these host interfaces.
Review whether they came from an earlier manual `sudo backend/setup-network.sh`
run before deleting anything. Do not remove a bridge that another workload owns.
EOF
fi

printf '\nRoutes involving common legacy lab subnets:\n'
ip route show table main | grep -E '(^| )192\.168\.(1|2)\.0/24( |$)' || printf 'None found.\n'

printf '\nHost IPv4 forwarding state (informational only):\n'
if [[ -r /proc/sys/net/ipv4/ip_forward ]]; then
  printf 'net.ipv4.ip_forward=%s\n' "$(cat /proc/sys/net/ipv4/ip_forward)"
else
  printf 'Unavailable.\n'
fi

printf '\nDocker networks:\n'
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker network ls
else
  printf 'Docker daemon unavailable.\n'
fi
