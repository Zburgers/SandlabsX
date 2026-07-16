# SandLabX agent and contributor guide

This file defines the operating constraints for automated and human contributors working in this repository.

## Primary objective

Improve SandLabX as a reliable single-host network and systems lab platform. Prefer changes that make labs repeatable, image operations recoverable, VM state observable, and development workflows easier to verify.

## Before changing code

1. Read the root `README.md` and the closest component README.
2. Run `make doctor` when host virtualization behavior is relevant.
3. Inspect existing modules and tests before creating another abstraction.
4. Work on a branch; do not push experimental changes directly to `main`.
5. Check existing issues and pull requests for overlapping work.

## Architectural rules

- Keep SandLabX a modular monolith unless a separate process has a clear operational benefit.
- Keep HTTP routes thin. Put reusable behavior in modules.
- Do not interpolate user input into shell command strings.
- Use `spawn` or equivalent argument arrays with shell execution disabled.
- Treat disk conversion, replacement, compaction, and deletion as transactions.
- Use staging files, validation, atomic publication, and cleanup on failure.
- Managed base images must not depend on external backing files.
- VM overlays are writable runtime state; base images are immutable templates.
- Preserve service boundaries described in `docs/ARCHITECTURE.md`.
- Refactor `qemuManager.js` incrementally behind its existing public interface.

## Safety and data integrity

- Never commit VM images, overlays, secrets, database data, or local environment files.
- Never delete persistent images or overlays as an incidental cleanup step.
- Require explicit overwrite behavior for managed images.
- Validate paths, identifiers, resource limits, and topology references.
- Keep privileged container mode opt-in.
- Do not weaken authentication, RBAC, rate limiting, or audit behavior to simplify a feature.
- Avoid logging credentials, JWTs, private image URLs, or full request bodies containing secrets.

## Development commands

```bash
make prepare
make doctor
make install
make test
make build
make up
make logs
```

Backend-specific checks:

```bash
cd backend
npm test
npm run check
npm run image:doctor
npm run sandlabx -- lab validate ../examples/labs/basic-routing.json
```

Frontend check:

```bash
cd frontend
npm run build
```

Compose check:

```bash
docker compose config --quiet
```

## Testing expectations

- Add focused regression tests for new domain behavior.
- Tests for image operations should use temporary directories and fake QEMU runners when possible.
- Cover failure cleanup, concurrency, invalid input, and idempotency—not only the success path.
- Do not require real KVM or multi-gigabyte images for unit tests.
- Container and integration tests may require Linux, Docker, `/dev/kvm`, and `/dev/net/tun`.
- State clearly when a change could not be exercised against real virtualization hardware.

## Documentation expectations

Update documentation in the same change when commands, architecture, configuration, image formats, or user-visible behavior change.

- Root setup or product behavior: `README.md`
- First-run workflow: `QUICK-START.md`
- Backend behavior: `backend/README.md`
- Frontend behavior: `frontend/README.md`
- Architecture decisions: `docs/ARCHITECTURE.md`
- Image operations: `docs/IMAGE-PIPELINE.md`
- Repository ownership: `STRUCTURE.md`

Avoid claims such as “production ready,” performance numbers, security guarantees, or complete endpoint coverage unless they are supported by current automated evidence.

## Pull request quality bar

A pull request should include:

- A concrete problem statement
- Scope and architectural impact
- User-visible changes
- Tests or validation performed
- Data migration or compatibility notes
- Risks and rollback guidance
- Follow-up work that was intentionally excluded

Keep commits understandable and prefer conventional prefixes such as `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `perf:`, `ci:`, and `chore:`.

## Current priorities

1. Route browser image imports through `ImagePipeline`.
2. Add asynchronous image jobs with progress and cancellation.
3. Split QEMU process, disk, network, and console responsibilities.
4. Compile validated lab specs into deployable lab records.
5. Add snapshots, linked clones, and portable lab bundles.
6. Replace polling with event-driven runtime status updates.
7. Add resource quotas and host-capacity admission checks.
