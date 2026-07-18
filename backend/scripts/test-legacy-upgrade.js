'use strict';

const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const TEST_DATABASE = 'sandlabx_legacy_upgrade_test';
const LEGACY_USER_ID = '11111111-1111-4111-8111-111111111111';

function databaseUrlFor(database) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

function runNode(script, databaseUrl) {
  const result = spawnSync(process.execPath, [script], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });

  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');

  if (result.status !== 0) {
    throw new Error(`${script} exited with status ${result.status}`);
  }
}

async function recreateDatabase(adminUrl) {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()`,
      [TEST_DATABASE],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DATABASE}`);
    await admin.query(`CREATE DATABASE ${TEST_DATABASE}`);
  } finally {
    await admin.end();
  }
}

async function seedLegacyDatabase(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE sandlabx_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE sandlabx_labs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        user_id UUID NOT NULL REFERENCES sandlabx_users(id) ON DELETE CASCADE,
        topology_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        template_name VARCHAR(255),
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE sandlabx_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        path VARCHAR(512) NOT NULL,
        format VARCHAR(20) DEFAULT 'qcow2',
        size_gb DECIMAL(10, 2),
        os_type VARCHAR(50),
        is_valid BOOLEAN DEFAULT TRUE,
        user_id UUID REFERENCES sandlabx_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE sandlabx_audit_log (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES sandlabx_users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        details JSONB,
        success BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE sandlabx_schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(
      `INSERT INTO sandlabx_users (id, email, password_hash, role)
       VALUES ($1, 'legacy-user@sandlabx.test', 'preserve-me', 'admin')`,
      [LEGACY_USER_ID],
    );
    await client.query(
      `INSERT INTO sandlabx_schema_migrations (version)
       VALUES ('001_lab_capsules.sql')`,
    );
  } finally {
    await client.end();
  }
}

async function verifyUpgrade(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const user = await client.query(
      'SELECT email, password_hash, role FROM sandlabx_users WHERE id = $1',
      [LEGACY_USER_ID],
    );
    if (user.rowCount !== 1 || user.rows[0].password_hash !== 'preserve-me') {
      throw new Error('Legacy user data was not preserved');
    }

    const nodes = await client.query("SELECT to_regclass('public.sandlabx_nodes') AS table_name");
    if (nodes.rows[0].table_name) throw new Error('sandlabx_nodes survived the guarded Capsule cutover');

    const legacyLedger = await client.query(
      "SELECT to_regclass('public.sandlabx_schema_migrations') AS table_name",
    );
    if (legacyLedger.rows[0].table_name) {
      throw new Error('Legacy migration ledger was not retired');
    }

    const migrations = await client.query(
      'SELECT name FROM sandlabx_migrations ORDER BY id',
    );
    const expectedMigrations = [
      '0001_core_schema',
      '0002_capsule_control_plane',
      '0003_retire_legacy_migration_ledger',
      '0004_capsule_platform_schema',
      '0005_capsule_platform_constraints',
      '0006_image_profile_versions',
      '0007_capsule_control_plane_persistence',
      '0008_resource_reservation_lifecycle',
      '0009_drop_empty_legacy_lab_runtime',
      '20260719000000_user_account_security',
    ];
    const appliedMigrations = migrations.rows.map((migration) => migration.name);
    if (
      appliedMigrations.length !== expectedMigrations.length
      || appliedMigrations.some((name, index) => name !== expectedMigrations[index])
    ) {
      throw new Error(
        `Expected migrations ${expectedMigrations.join(', ')}, found ${appliedMigrations.join(', ')}`,
      );
    }

    console.log('[legacy-upgrade] partial legacy database upgraded without data loss');
  } finally {
    await client.end();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const adminUrl = databaseUrlFor('postgres');
  const upgradeUrl = databaseUrlFor(TEST_DATABASE);

  await recreateDatabase(adminUrl);
  await seedLegacyDatabase(upgradeUrl);
  runNode('scripts/migrate.js', upgradeUrl);
  runNode('scripts/check-schema.js', upgradeUrl);
  await verifyUpgrade(upgradeUrl);
}

main().catch((error) => {
  console.error('[legacy-upgrade] test failed');
  console.error(error);
  process.exit(1);
});
