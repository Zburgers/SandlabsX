#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose)
FAIL=0
WARN=0

pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*" >&2; WARN=$((WARN + 1)); }
fail() { printf 'FAIL  %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

service_running() {
  local service="$1"
  if "${COMPOSE[@]}" ps --status running --services | grep -Fxq "$service"; then
    pass "$service is running"
  else
    fail "$service is not running"
  fi
}

job_completed() {
  local container="$1" label="$2" state
  if ! docker inspect "$container" >/dev/null 2>&1; then
    fail "$label container does not exist"
    return
  fi

  state="$(docker inspect -f '{{.State.Status}}:{{.State.ExitCode}}' "$container")"
  if [[ "$state" == "exited:0" ]]; then
    pass "$label completed successfully"
  else
    fail "$label state is $state"
  fi
}

http_check() {
  local label="$1" url="$2"
  if curl -fsS --max-time 5 "$url" >/dev/null; then
    pass "$label is reachable at $url"
  else
    fail "$label is not reachable at $url"
  fi
}

command -v docker >/dev/null 2>&1 || {
  printf 'Docker is required.\n' >&2
  exit 127
}
"${COMPOSE[@]}" version >/dev/null 2>&1 || {
  printf 'Docker Compose v2 is required.\n' >&2
  exit 127
}

"${COMPOSE[@]}" config --quiet || {
  printf 'Compose configuration is invalid.\n' >&2
  exit 1
}

printf 'SandLabX runtime verification\n'
printf '=============================\n'

for service in postgres guacd guacamole backend frontend; do
  service_running "$service"
done

job_completed sandlabx-guacamole-schema "Guacamole schema source"
job_completed sandlabx-guacamole-db-init "Guacamole database initializer"
job_completed sandlabx-migrate "SandLabX migrator"

if "${COMPOSE[@]}" exec -T postgres pg_isready \
    -U "${POSTGRES_USER:-guacamole_user}" \
    -d "${POSTGRES_DB:-guacamole_db}" >/dev/null 2>&1; then
  pass "PostgreSQL accepts connections"
else
  fail "PostgreSQL readiness check failed"
fi

if "${COMPOSE[@]}" exec -T backend npm run db:check >/dev/null 2>&1; then
  pass "SandLabX migration ledger and required tables are valid"
else
  fail "SandLabX schema verification failed"
  "${COMPOSE[@]}" exec -T backend npm run db:check || true
fi

if "${COMPOSE[@]}" exec -T postgres psql -Atqc \
    "SELECT to_regclass('public.guacamole_connection') IS NOT NULL" \
    -U "${POSTGRES_USER:-guacamole_user}" \
    -d "${POSTGRES_DB:-guacamole_db}" 2>/dev/null | grep -Fxq t; then
  pass "Guacamole vendor schema exists"
else
  fail "Guacamole vendor schema is missing"
fi

if "${COMPOSE[@]}" exec -T postgres psql -Atqc \
    "SELECT to_regclass('public.sandlabx_schema_migrations') IS NULL" \
    -U "${POSTGRES_USER:-guacamole_user}" \
    -d "${POSTGRES_DB:-guacamole_db}" 2>/dev/null | grep -Fxq t; then
  pass "retired custom migration ledger is absent"
else
  fail "retired sandlabx_schema_migrations ledger still exists"
fi

http_check "Backend health" "http://${BIND_ADDRESS:-127.0.0.1}:${BACKEND_PORT:-3001}/api/health"
http_check "Frontend" "http://${BIND_ADDRESS:-127.0.0.1}:${FRONTEND_PORT:-3000}/"
http_check "Guacamole" "http://${BIND_ADDRESS:-127.0.0.1}:${GUACAMOLE_PORT:-8081}/guacamole/"

if "${COMPOSE[@]}" exec -T backend test -r /dev/kvm -a -w /dev/kvm; then
  pass "/dev/kvm is usable inside backend"
else
  warn "/dev/kvm is not usable; KVM-only workloads will fail and TCG may be slow"
fi

if "${COMPOSE[@]}" exec -T backend test -c /dev/net/tun; then
  pass "/dev/net/tun is available inside backend"
else
  fail "/dev/net/tun is unavailable inside backend"
fi

network_mode="$("${COMPOSE[@]}" exec -T backend printenv SANDLABX_NETWORK_MODE 2>/dev/null || true)"
case "$network_mode" in
  legacy-l2)
    for bridge in sandlabx-br0 sandlabx-br1; do
      if "${COMPOSE[@]}" exec -T backend ip -d link show "$bridge" 2>/dev/null | grep -q bridge; then
        pass "LEGACY container bridge $bridge exists"
      else
        fail "LEGACY container bridge $bridge is missing"
        continue
      fi

      if "${COMPOSE[@]}" exec -T backend sh -c \
          "ip -o -4 addr show dev '$bridge' scope global | grep -q ."; then
        fail "$bridge has an unexpected IPv4 address"
      else
        pass "$bridge is unnumbered at Layer 3"
      fi
    done
    ;;
  disabled|plan-only)
    pass "legacy network bootstrap is disabled ($network_mode)"
    ;;
  *)
    fail "unexpected SANDLABX_NETWORK_MODE=${network_mode:-unset}"
    ;;
esac

if "${COMPOSE[@]}" exec -T backend sh -c 'test ! -e /var/run/docker.sock'; then
  pass "Docker socket is not mounted into backend"
else
  fail "Docker socket is exposed to backend"
fi

printf '\nCompose state:\n'
"${COMPOSE[@]}" ps --all

printf '\nSummary: %d failure(s), %d warning(s)\n' "$FAIL" "$WARN"
[[ "$FAIL" -eq 0 ]]
