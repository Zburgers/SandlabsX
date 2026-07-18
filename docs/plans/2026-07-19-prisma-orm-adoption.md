# Prisma ORM Adoption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hand-authored `node-pg-migrate` sequencing with Prisma's declarative PostgreSQL schema and generated, reviewed migration workflow while preserving SandLabX data and PostgreSQL-specific safety rules.

**Architecture:** Prisma becomes the schema and migration authority for SandLabX-owned tables. The existing Compose `migrate` service remains the only deployment-time writer, but runs `prisma migrate deploy`; Guacamole keeps owning its vendor schema. Repository interfaces remain stable while each is migrated from `pg` queries to Prisma Client, which prevents a big-bang HTTP/API rewrite.

**Tech Stack:** Node.js 20, CommonJS initially, PostgreSQL 16, Prisma ORM and Prisma Migrate, Docker Compose, Node test runner.

---

## Decisions and constraints

- Choose Prisma, not a schema-push workflow. `prisma migrate dev` generates reviewed SQL locally; `prisma migrate deploy` applies only committed migrations in Compose/CI.
- Do not use `prisma db push` for shared, staging, or production databases.
- Keep generated SQL migrations under version control and never edit an applied migration.
- Preserve raw SQL for `pgcrypto`, PL/pgSQL trigger functions, partial indexes, check constraints, and data backfills that Prisma schema syntax cannot express.
- Baseline the existing database once. Never reset the persistent `pgdata` volume as part of adoption.
- The Guacamole database objects are vendor-owned and excluded from Prisma models/migrations.

### Task 1: Establish the baseline contract

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/0_sandlabx_baseline/migration.sql`
- Create: `backend/test/prisma-baseline.test.js`
- Modify: `backend/package.json`

**Step 1: Write the failing test**

Create a disposable PostgreSQL database, run the baseline migration, and assert that all SandLabX-owned tables, the user-security columns, required check constraints, indexes, and trigger functions exist. Explicitly assert that no Guacamole table is created by the baseline.

**Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/prisma-baseline.test.js`

Expected: FAIL because Prisma schema and baseline migration do not exist.

**Step 3: Generate a schema from the current database**

Run `prisma db pull` only against a disposable copy of the current schema. Move SandLabX models into `prisma/schema.prisma`; omit Guacamole models. Map existing `sandlabx_*` table and snake-case column names rather than renaming deployed objects.

**Step 4: Create and review the baseline**

Generate the SQL with `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`, then add manual SQL for extensions, triggers, partial indexes, and constraints. Review every destructive or data-changing statement.

**Step 5: Verify the test passes**

Run: `cd backend && node --test test/prisma-baseline.test.js`

Expected: PASS on a fresh disposable database.

**Step 6: Commit**

```bash
git add backend/prisma backend/test/prisma-baseline.test.js backend/package.json
git commit -m "feat(db): add Prisma schema baseline"
```

### Task 2: Baseline existing persisted environments safely

**Files:**
- Create: `backend/scripts/prisma-baseline.js`
- Create: `backend/test/prisma-baseline-existing.test.js`
- Modify: `backend/package.json`
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Write the failing test**

Create a database at the current `node-pg-migrate` head, execute the baseline script, then assert it marks the baseline as applied without changing row counts or dropping objects.

**Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/prisma-baseline-existing.test.js`

Expected: FAIL because no safe baseline command exists.

**Step 3: Implement the explicit baseline guard**

Require `SANDLABX_PRISMA_BASELINE=YES`, verify the current schema contract and the legacy migration head, then invoke `prisma migrate resolve --applied 0_sandlabx_baseline`. Refuse to proceed if the database is incomplete or already baselined.

**Step 4: Verify the test passes**

Run: `cd backend && node --test test/prisma-baseline-existing.test.js`

Expected: PASS with unchanged data and a recorded Prisma baseline.

**Step 5: Commit**

```bash
git add backend/scripts/prisma-baseline.js backend/test/prisma-baseline-existing.test.js backend/package.json docs/ARCHITECTURE.md
git commit -m "feat(db): baseline existing databases for Prisma"
```

### Task 3: Move migration execution to Prisma

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/scripts/migrate.js`
- Delete: `backend/modules/migrationRunner.js`
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `backend/test/migrations-capsule-platform.test.js`

**Step 1: Write the failing test**

Change the migration integration test to invoke the deployment migration command twice and assert the second run is a no-op. Assert the Prisma migration ledger records the baseline and every later migration.

**Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/migrations-capsule-platform.test.js`

Expected: FAIL because Compose and the script still invoke `node-pg-migrate`.

**Step 3: Implement the minimal deployment path**

Replace `db:migrate` with `prisma migrate deploy`; update the Compose `migrate` command and CI migration gate. Keep `check-schema.js`, but make it assert the Prisma ledger and domain contract instead of a `sandlabx_migrations` table. Remove the obsolete startup compatibility module and its wiring only after readiness checks have equivalent coverage.

**Step 4: Verify the test passes**

Run: `cd backend && node --test test/migrations-capsule-platform.test.js && npm run db:check`

Expected: PASS and a no-op second deploy.

**Step 5: Commit**

```bash
git add backend/package.json backend/scripts/migrate.js backend/scripts/check-schema.js docker-compose.yml .github/workflows/ci.yml backend/test/migrations-capsule-platform.test.js
git rm backend/modules/migrationRunner.js
git commit -m "refactor(db): deploy migrations with Prisma"
```

### Task 4: Migrate database access one bounded module at a time

**Files:**
- Modify: `backend/platform/database.js`
- Modify: `backend/repositories/capsuleRepository.js`
- Modify: `backend/repositories/scenarioRepository.js`
- Modify: `backend/repositories/assignmentRepository.js`
- Modify: `backend/repositories/instanceRepository.js`
- Modify: `backend/repositories/operationRepository.js`
- Modify: `backend/repositories/allocationRepository.js`
- Modify: `backend/repositories/reservationRepository.js`
- Modify: `backend/repositories/imageArtifactRepository.js`
- Modify: `backend/repositories/workloadProfileRepository.js`
- Modify: `backend/test/*.test.js`

**Step 1: Write one failing repository contract test per module**

Use the existing repository behavior as the contract: ownership filtering, immutable revisions, optimistic/version sequencing, transactions, and exact constraint failures. Start with `capsuleRepository.js`; do not migrate the next repository until its focused tests pass.

**Step 2: Run the focused test to verify it fails**

Run: `cd backend && node --test test/capsule-control-plane-postgres.test.js`

Expected: FAIL after changing only the test seam to expect injected Prisma Client usage.

**Step 3: Implement the smallest compatible adapter**

Instantiate one Prisma Client in `platform/database.js`; inject a transaction-capable adapter into the existing repository constructors. Preserve repository method names and service interfaces. Use `$queryRaw` only for PostgreSQL features Prisma Client cannot express, with tagged parameterized queries.

**Step 4: Verify the focused test and full suite pass**

Run: `cd backend && node --test test/capsule-control-plane-postgres.test.js && npm test`

Expected: PASS.

**Step 5: Repeat and commit one repository family at a time**

```bash
git add backend/platform/database.js backend/repositories/<family>.js backend/test/<family>.test.js
git commit -m "refactor(db): move <family> repository to Prisma"
```

### Task 5: Migrate auth, user administration, audit, and CLI persistence

**Files:**
- Modify: `backend/controllers/authController.js`
- Modify: `backend/controllers/userController.js`
- Modify: `backend/modules/auditLogger.js`
- Modify: `backend/cli/sandlabx.js`
- Modify: `backend/server.js`
- Modify: related `backend/test/*.test.js`

**Step 1: Write failing behavior tests**

Cover registration's default student role, login/password change, role changes, audit writes, and image/profile CLI persistence. Tests must verify behavior, not Prisma calls.

**Step 2: Run tests to verify failure**

Run: `cd backend && npm test`

Expected: FAIL because these components still construct their own `pg` pools.

**Step 3: Inject the shared Prisma client**

Remove component-owned pools and pass the application database dependency from the composition root. Retain explicit transactions for password/audit and multi-write operations.

**Step 4: Verify**

Run: `cd backend && npm run check && cd ../frontend && npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/controllers backend/modules/auditLogger.js backend/cli/sandlabx.js backend/server.js backend/test
git commit -m "refactor(db): move auth and audit persistence to Prisma"
```

### Task 6: Retire legacy tooling and document the supported workflow

**Files:**
- Delete: `backend/migrations/`
- Delete: `backend/scripts/test-legacy-upgrade.js`
- Modify: `backend/package.json`
- Modify: `backend/README.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `Makefile`

**Step 1: Write a failing workflow test**

Assert `npm run db:migrate:create -- add_feature` produces a timestamped Prisma migration and `npm run db:migrate` applies it to a disposable database. Assert no legacy `node-pg-migrate` command remains in runtime or CI configuration.

**Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/database-workflow.test.js`

Expected: FAIL while legacy scripts and dependency remain.

**Step 3: Remove only superseded code**

Remove `node-pg-migrate`, old migration runner/scripts, and legacy migration files after every supported environment has been baselined. Keep focused schema-health checks and integration tests.

**Step 4: Verify the delivery surface**

Run: `make test && make build && docker compose config --quiet && docker compose up --build --wait`

Expected: all checks pass; `migrate` exits 0; backend becomes healthy.

**Step 5: Commit**

```bash
git add README.md backend/README.md docs/ARCHITECTURE.md Makefile backend/package.json backend/test
git rm -r backend/migrations backend/scripts/test-legacy-upgrade.js
git commit -m "chore(db): retire legacy migration tooling"
```

## Rollout and rollback

1. Back up the PostgreSQL volume before Task 2.
2. Run the explicit baseline once per retained environment, recording the database name and Git SHA in the deployment handoff.
3. Deploy the Prisma migration service first; only then deploy code that requires the Prisma Client.
4. If a deployment fails before Prisma applies a new migration, roll back the application image normally. If a migration was applied, roll forward with an additive corrective migration; do not delete or rewrite migration history.

## Explicit legacy surface after completion

Dead only after all environments are baselined: `node-pg-migrate`, `backend/migrations/`, `backend/scripts/migrate.js`, `backend/modules/migrationRunner.js`, `backend/scripts/test-legacy-upgrade.js`, the `sandlabx_migrations` ledger, and numeric migration-name documentation. The Compose migration service, schema-health checks, repository/service boundaries, PostgreSQL integration tests, Guacamole initializer, and `pg` driver (used by Prisma's PostgreSQL adapter) remain necessary.
