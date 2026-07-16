#!/usr/bin/env bash
set -uo pipefail

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
    printf '%-5s %-24s %s\n' "${status^^}" "$name" "$detail"
  fi
}

command_check() {
  local command="$1" label="${2:-$1}"
  if command -v "$command" >/dev/null 2>&1; then
    record pass "$label" "$(command -v "$command")"
  else
    record fail "$label" "not found in PATH"
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

command_check docker Docker
if docker compose version >/dev/null 2>&1; then
  record pass "Docker Compose" "$(docker compose version --short 2>/dev/null || echo available)"
else
  record fail "Docker Compose" "docker compose plugin unavailable"
fi
command_check node Node.js
command_check npm npm
command_check qemu-img qemu-img
command_check qemu-system-x86_64 QEMU

if [[ -e /dev/kvm ]]; then
  if [[ -r /dev/kvm && -w /dev/kvm ]]; then
    record pass KVM "/dev/kvm is readable and writable"
  else
    record warn KVM "/dev/kvm exists but current user lacks read/write access"
  fi
else
  record warn KVM "/dev/kvm not present; VMs will use slow software emulation"
fi

if [[ -c /dev/net/tun ]]; then
  record pass TUN "/dev/net/tun is available"
else
  record fail TUN "/dev/net/tun is unavailable"
fi

for directory in images overlays vms; do
  if [[ -d "$directory" && -w "$directory" ]]; then
    record pass "$directory directory" "writable"
  elif [[ -d "$directory" ]]; then
    record fail "$directory directory" "not writable"
  else
    record warn "$directory directory" "missing; create with make prepare"
  fi
done

port_check 3000 Frontend
port_check 3001 Backend
port_check 8081 Guacamole
port_check 5432 PostgreSQL

if [[ "$JSON" == true ]]; then
  printf '{"ok":%s,"pass":%d,"warn":%d,"fail":%d,"checks":[' "$([[ $FAIL -eq 0 ]] && echo true || echo false)" "$PASS" "$WARN" "$FAIL"
  first=true
  for result in "${RESULTS[@]}"; do
    IFS='|' read -r status name detail <<<"$result"
    [[ "$first" == true ]] || printf ','
    first=false
    node -e 'process.stdout.write(JSON.stringify({status:process.argv[1],name:process.argv[2],detail:process.argv[3]}))' "$status" "$name" "$detail"
  done
  printf ']}\n'
else
  printf '\nSummary: %d passed, %d warnings, %d failed\n' "$PASS" "$WARN" "$FAIL"
fi

[[ $FAIL -eq 0 ]]
