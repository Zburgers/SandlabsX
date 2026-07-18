'use strict';

const path = require('node:path');
const { Client } = require('pg');

const ACCIDENTAL_SEQUENCE = [
  ['0004_user_account_security', '20260719000000_user_account_security'],
  ['0005_capsule_platform_schema', '0004_capsule_platform_schema'],
  ['0006_capsule_platform_constraints', '0005_capsule_platform_constraints'],
  ['0007_image_profile_versions', '0006_image_profile_versions'],
  ['0008_capsule_control_plane_persistence', '0007_capsule_control_plane_persistence'],
  ['0009_resource_reservation_lifecycle', '0008_resource_reservation_lifecycle'],
  ['0010_drop_empty_legacy_lab_runtime', '0009_drop_empty_legacy_lab_runtime'],
];

const direction = process.argv[2] || 'up';
const countArg = process.argv[3];

if (!['up', 'down'].includes(direction)) {
  console.error(`Unsupported migration direction: ${direction}`);
  process.exit(64);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for database migrations.');
  process.exit(64);
}

if (direction === 'down' && process.env.SANDLABX_ALLOW_MIGRATION_DOWN !== 'YES') {
  console.error('Refusing migration rollback. Set SANDLABX_ALLOW_MIGRATION_DOWN=YES after reviewing data-loss risk.');
  process.exit(64);
}

async function main() {
  const { runner } = await import('node-pg-migrate');
  const count = countArg === undefined ? undefined : Number.parseInt(countArg, 10);

  if (countArg !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new Error(`Invalid migration count: ${countArg}`);
  }

  if (direction === 'up') await repairAccidentalMigrationSequence(process.env.DATABASE_URL);

  await runner({
    databaseUrl: process.env.DATABASE_URL,
    dir: path.resolve(__dirname, '..', 'migrations'),
    direction,
    count,
    schema: 'public',
    migrationsSchema: 'public',
    migrationsTable: 'sandlabx_migrations',
    checkOrder: true,
    singleTransaction: true,
    advisoryLockMode: 'wait',
    verbose: process.env.SANDLABX_MIGRATION_VERBOSE === 'true',
    log: (message) => console.log(`[sandlabx-migrate] ${message}`),
  });
}

async function repairAccidentalMigrationSequence(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const ledger = await client.query("SELECT to_regclass('public.sandlabx_migrations') AS name");
    if (!ledger.rows[0].name) return false;
    const sourceNames = ACCIDENTAL_SEQUENCE.map(([source]) => source);
    const mappedTargets = ACCIDENTAL_SEQUENCE.map(([, target]) => target);
    const targetNames = [...mappedTargets.slice(1), mappedTargets[0]];
    const records = await client.query('SELECT id, name, run_on FROM sandlabx_migrations WHERE name = ANY($1::text[]) ORDER BY id', [[...sourceNames, ...targetNames]]);
    const nameSet = new Set(records.rows.map(({ name }) => name));
    const hasAccidentalSequence = sourceNames.every((name) => nameSet.has(name));
    const hasCanonicalSequence = targetNames.every((name) => nameSet.has(name));
    const canonicalRecords = records.rows.filter(({ name }) => targetNames.includes(name));
    const canonicalRunOnOutOfOrder = canonicalRecords.some((record, index) => index > 0 && new Date(record.run_on) < new Date(canonicalRecords[index - 1].run_on));
    const canonicalOutOfOrder = hasCanonicalSequence && (canonicalRecords.map(({ name }) => name).join('|') !== targetNames.join('|') || canonicalRunOnOutOfOrder);
    if (hasCanonicalSequence && !canonicalOutOfOrder) return false;
    if (!hasAccidentalSequence && !canonicalOutOfOrder) {
      const hasSequenceEdge = nameSet.has('0004_user_account_security') || nameSet.has('0010_drop_empty_legacy_lab_runtime');
      if (hasSequenceEdge) throw new Error('Partial accidental migration sequence detected; refusing automatic ledger repair');
      return false;
    }
    const columns = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sandlabx_users' AND column_name = ANY($1::text[])`, [['is_active', 'must_change_password', 'auth_version', 'updated_at']]);
    if (columns.rowCount !== 4) throw new Error('Account-security schema does not match the accidental migration ledger; refusing repair');
    const latestRunOn = Math.max(...records.rows.map(({ run_on: runOn }) => new Date(runOn).getTime()));
    await client.query('BEGIN');
    await client.query('DELETE FROM sandlabx_migrations WHERE name = ANY($1::text[])', [[...sourceNames, ...targetNames]]);
    for (const [index, target] of targetNames.entries()) {
      await client.query('INSERT INTO sandlabx_migrations (name, run_on) VALUES ($1, $2)', [target, new Date(latestRunOn + index + 1)]);
    }
    await client.query('COMMIT');
    console.log('[sandlabx-migrate] Repaired the guarded accidental migration-name sequence');
    return true;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[sandlabx-migrate] Migration failed');
  console.error(error);
  process.exit(1);
});

module.exports = { repairAccidentalMigrationSequence, ACCIDENTAL_SEQUENCE };
