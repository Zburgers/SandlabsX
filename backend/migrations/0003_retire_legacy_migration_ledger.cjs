'use strict';

/**
 * The retired migrationRunner.js tracked SQL filenames in
 * sandlabx_schema_migrations. node-pg-migrate now owns migration state in
 * sandlabx_migrations, so the old ledger is no longer authoritative.
 */
exports.up = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS sandlabx_schema_migrations;');
};

exports.down = false;
