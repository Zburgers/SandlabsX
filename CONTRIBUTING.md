# Contributing to SandLabX

## Development setup

```bash
git clone https://github.com/Zburgers/SandlabsX.git
cd SandlabsX
cp .env.example .env
make prepare
make doctor
make install
```

Create a focused branch from the current default branch:

```bash
git switch -c feat/descriptive-name
```

## Verification

Run the checks relevant to your change before opening a pull request:

```bash
make test
cd frontend && npm run build
cd .. && docker compose config --quiet
```

Container or virtualization changes should also run:

```bash
make build
make up
docker compose ps
curl http://localhost:3001/api/health
```

Real VM testing requires a Linux host with `/dev/kvm` and `/dev/net/tun`.

## Change design

- Put reusable behavior in modules rather than route handlers.
- Add tests for failure paths and cleanup behavior.
- Avoid shell command construction with user-controlled values.
- Preserve existing API contracts during internal refactors.
- Keep base images immutable and treat overlays as runtime state.
- Make destructive operations explicit and recoverable where possible.
- Update documentation with code changes.

## Commits

Use clear, scoped commits:

```text
feat(images): add catalog import
fix(qemu): prevent duplicate VNC allocation
refactor(api): extract image routes
perf(frontend): reduce runtime image
ci: validate compose configuration
docs: update installation workflow
```

## Pull requests

Describe:

1. The problem and why it matters
2. The implementation and architectural impact
3. Tests and manual verification
4. Configuration or compatibility changes
5. Risks and rollback steps
6. Follow-up work intentionally left out

Do not claim production readiness or complete security without current evidence. Call out anything that could not be tested against real virtualization hardware.
