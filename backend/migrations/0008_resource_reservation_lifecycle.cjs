'use strict';

exports.up = (pgm) => pgm.sql(`
ALTER TABLE sandlabx_resource_reservations
  DROP CONSTRAINT IF EXISTS sandlabx_resource_reservations_resource_type_resource_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS sandlabx_resource_reservations_active_key_unique
  ON sandlabx_resource_reservations(resource_type, resource_key)
  WHERE state = 'ACTIVE';
`);

exports.down = false;
