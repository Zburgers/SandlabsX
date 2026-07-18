#!/usr/bin/env bash
set -euo pipefail

failures=()
[[ -r /dev/kvm && -w /dev/kvm ]] || failures+=("/dev/kvm is not accessible")
[[ -r /dev/net/tun && -w /dev/net/tun ]] || failures+=("/dev/net/tun is not accessible")
command -v qemu-system-x86_64 >/dev/null || failures+=("qemu-system-x86_64 is unavailable")
[[ -w vms && -w pids && -w overlays && -w checkpoints ]] || failures+=("runtime roots are not writable")
[[ -n "${SANDLABX_QUALIFICATION_IMAGE:-}" && -f "${SANDLABX_QUALIFICATION_IMAGE:-}" ]] || failures+=("SANDLABX_QUALIFICATION_IMAGE must name a pinned managed QCOW2")

if ! node -e "const { OperationRepository } = require('./backend/repositories/operationRepository'); for (const method of ['leaseNext','upsertStep','markStep','finish']) if (typeof OperationRepository.prototype[method] !== 'function') process.exit(1)"; then
  failures+=("OperationRepository lacks the durable runner lease/step contract")
fi

if ((${#failures[@]})); then
  printf '%s\n' '[capsule-qualify] BLOCKED: real-host qualification was not run.' >&2
  printf '%s\n' "${failures[@]/#/[capsule-qualify] - }" >&2
  exit 2
fi

printf '%s\n' '[capsule-qualify] Preconditions passed; real-host fixture execution is not yet implemented.' >&2
exit 2
