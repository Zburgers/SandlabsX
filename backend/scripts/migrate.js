'use strict';

const path = require('node:path');

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

main().catch((error) => {
  console.error('[sandlabx-migrate] Migration failed');
  console.error(error);
  process.exit(1);
});
