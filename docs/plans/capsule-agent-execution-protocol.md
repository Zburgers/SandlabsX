# Capsule agent execution protocol

This protocol applies to Agents A-H. The approved architecture design and master implementation plan remain the source of truth.

## Branch policy

Agents may work on the shared `feat/lab-capsules-scenario-engine` branch when the user assigns them sequentially. Separate worktrees are recommended for genuinely concurrent execution but are not mandatory.

Before editing, every agent must:

1. Verify `pwd`, branch, `git status --short --branch`, and current HEAD.
2. Refuse to overwrite unrelated dirty files.
3. Read the exact design and master-plan line ranges listed in its packet.
4. State its exclusive file ownership and dependencies.

## Commit policy

Every implementation commit must use the agent prefix:

```text
[A] test: inventory capsule replacement debt
[C] feat: version workload profiles
[H] refactor: remove legacy lab runtime
```

Use multiple logical commits where the packet specifies them. Never claim work is committed without reporting exact SHAs and a clean/known working-tree state.

## Completion policy

Passing the repository's existing tests is necessary but not sufficient. An agent is complete only when:

- every file required by its packet exists or an approved owner has accepted the change request;
- every required focused test was first observed failing and then passes;
- every acceptance command in the packet was run with exact output summarized;
- required external gates were actually attempted when prerequisites are available;
- missing prerequisites are proven with diagnostic output, not assumed;
- source syntax, `git diff --check`, and scope/ownership checks pass;
- no placeholder, stub, TODO, skipped test, or temporary mock remains unless the packet explicitly permits it;
- its packet contains a committed `## Completion evidence` section;
- the master plan's `Parallel execution status` entry is updated by the coordinator or Agent H.

An agent must report `BLOCKED` or `REMEDIATION REQUIRED`, never `complete`, when a mandatory test file or gate is missing.

## Virtualization preflight and blocked-host policy

Agents whose packet touches disks, QEMU, TAP/bridge networking, consoles, checkpoints, or end-to-end runtime qualification must run these checks before claiming live verification:

```bash
make prepare
make doctor
docker compose config --quiet
```

`vms/` and `pids/` are host bind-mount roots and must be writable by the developer running host-side checks. Root ownership is not intended; it commonly occurs when Docker creates a missing bind source before `make prepare`. Do not bypass this with world-writable permissions and do not recursively change ownership of VM data. Stop the stack and ask the user to repair only each affected root directory, for example `sudo chown "$(id -u):$(id -g)" vms pids`, then rerun `make prepare && make doctor`.

Occupied default ports are warnings when they belong to the intended SandLabX stack. Prove ownership with `docker compose ps` and `ss -ltnp`; otherwise use explicit alternate `FRONTEND_PORT`, `BACKEND_PORT`, `GUACAMOLE_PORT`, and `POSTGRES_PORT` values for isolated qualification. Unit tests must use temporary directories and fake runners and must not be blocked by host bind mounts. Real-KVM qualification may not be marked passed until writable runtime roots, KVM/TUN access, isolated ports, managed test images, cleanup, and post-run network audit all pass.

## Handoff format

No separate prose prompt is required. The agent packet plus this protocol is the prompt. At completion, append this structure to the packet and commit it:

```markdown
## Completion evidence

- Status: COMPLETE | BLOCKED | REMEDIATION REQUIRED
- Branch and final HEAD:
- Commits:
- Owned files changed:
- Contracts exported:
- Tests run and results:
- External/runtime gates:
- Known limitations:
- Requested changes for Agent H-owned files:
- Downstream agents unblocked:
```

The final chat response must reproduce the same evidence, not replace it.

## Shared-file policy

Agent H owns shared composition and final cutover files. Other agents provide explicit requested changes in their completion evidence. On a shared sequential branch, Agent H may apply those changes later without requiring cherry-picks.

If an agent discovers a source-of-truth defect, it must stop that affected portion and provide:

- document and exact lines;
- observed evidence;
- proposed correction;
- downstream impact.

Only Agent H or the coordinator updates the architecture or master plan.
