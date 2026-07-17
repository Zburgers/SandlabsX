#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

JSON=false
[[ "${1:-}" == "--json" ]] && JSON=true
PASS=0
FAIL=0
WARN=0
RESULTS=()

record() {
  local status="$1" name="$2" detail="$3"
  case "$status" in
    pass) PASS=$((PASS + 1)) ;;
    fail) FAIL=$((FAIL + 1)) ;;
    warn) WARN=$((WARN + 1)) ;;
  esac
  RESULTS+=("$status|$name|$detail")
  if [[ "$JSON" != true ]]; then
    printf '%-5s %-26s %s\n' "${status^^}" "$name" "$detail"
  fi
}

required_command() {
  local command="$1" label="${2:-$1}"
  if command -v "$command" >/dev/null 2>&1; then
    record pass "$label" "$(command -v "$command")"
  else
    record fail "$label" "not found in PATH"
  fi
}

optional_command() {
  local command="$1" label="${2:-$1}" purpose="$3"
  if command -v "$command" >/dev/null 2>&1; then
    record pass "$label" "$(command -v "$command")"
  else
    record warn "$label" "not installed on host; needed only for $purpose"
  fi
}

port_check() {
  local port="$1" label="$2"
  if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$port" 2>/dev/null | tail -n +2 | grep -q .; then
    record warn "$label" "port $port is already in use"
  else
    record pass "$label" "port $port is available"
  fi
}

required_command docker Docker

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    record pass "Docker daemon" "reachable"
  else
    record fail "Docker daemon" "not reachable by the current user"
  fi

  if docker compose version >/dev/null 2>&1; then
    record pass "Docker Compose" "$(docker compose version --short 2>/dev/null || echo available)"
  else
    record fail "Docker Compose" "v2 plugin unavailable"
  fi

  if docker compose config --quiet >/dev/null 2>&1; then
    record pass "Compose config" "valid"
  else
    record fail "Compose config" "invalid; run docker compose config for details"
  fi
fi

# Host Node/QEMU binaries are optional because the supported runtime is built
# into containers. They remain useful for CLI development and diagnostics.
optional_command node "Host Node.js" "running developer CLI commands outside Docker"
optional_command npm "Host npm" "running developer CLI commands outside Docker"
optional_command qemu-img "Host qemu-img" "host-side image diagnostics"
optional_command qemu-system-x86_64 "Host QEMU" "the explicitly enabled legacy host runtime"

if [[ -e /dev/kvm ]]; then
  if [[ -r /dev/kvm && -w /dev/kvm ]]; then
    record pass KVM "/dev/kvm is readable and writable"
  else
    record warn KVM "/dev/kvm exists but current user lacks read/write access"
  fi
else
  record warn KVM "/dev/kvm not present; KVM-backed VM execution will not work"
fi

if [[ -c /dev/net/tun ]]; then
  if [[ -r /dev/net/tun && -w /dev/net/tun ]]; then
    record pass TUN "/dev/net/tun is readable and writable"
  else
    record warn TUN "/dev/net/tun exists but current user lacks read/write access"
  fi
else
  record warn TUN "/dev/net/tun is unavailable; TAP-backed VM networking will not work"
fi

for directory in images images/custom overlays vms pids checkpoints; do
  if [[ -d "$directory" && -w "$directory" ]]; then
    record pass "$directory directory" "writable"
  elif [[ -d "$directory" ]]; then
    record fail "$directory directory" "not writable"
  else
    record warn "$directory directory" "missing; create with make prepare"
  fi
done

if command -v ip >/dev/null 2>&1; then
  for bridge in sandlabx-br0 sandlabx-br1; do
    if ip link show "$bridge" >/dev/null 2>&1; then
      record warn "Host $bridge" "legacy bridge exists in host namespace; inspect with make network-audit"
    else
      record pass "Host $bridge" "not present"
    fi
  done
fi

port_check "${FRONTEND_PORT:-2000}" Frontend
port_check "${BACKEND_PORT:-3001}" Backend
port_check "${GUACAMOLE_PORT:-8081}" Guacamole
port_check "${POSTGRES_PORT:-5432}" PostgreSQL

if [[ "$JSON" == true ]]; then
  printf '{"ok":%s,"pass":%d,"warn":%d,"fail":%d,"checks":[' "$([[ $FAIL -eq 0 ]] && echo true || echo false)" "$PASS" "$WARN" "$FAIL"
  first=true
  for result in "${RESULTS[@]}"; do
    IFS='|' read -r status name detail <<<"$result"
    [[ "$first" == true ]] || printf ','
    first=false
    if command -v node >/dev/null 2>&1; then
      node -e 'process.stdout.write(JSON.stringify({status:process.argv[1],name:process.argv[2],detail:process.argv[3]}))' "$status" "$name" "$detail"
    else
      printf '{"status":"%s","name":"%s","detail":"%s"}' "$status" "$name" "$detail"
    fi
  done
  printf ']}\n'
else
  printf '\nSummary: %d passed, %d warnings, %d failed\n' "$PASS" "$WARN" "$FAIL"
fi

[[ $FAIL -eq 0 ]]
