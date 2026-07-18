'use strict';

exports.up = (pgm) => pgm.sql(`
DO $$
DECLARE
  table_name text;
  row_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sandlabx_labs', 'sandlabx_nodes', 'sandlabx_connections', 'sandlabx_console_sessions'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I', table_name) INTO row_count;
      IF row_count <> 0 THEN
        RAISE EXCEPTION 'Capsule cutover blocked: legacy table % contains % row(s)', table_name, row_count
          USING ERRCODE = '55000';
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS sandlabx_console_sessions CASCADE;
DROP TABLE IF EXISTS sandlabx_connections CASCADE;
DROP TABLE IF EXISTS sandlabx_nodes CASCADE;
DROP TABLE IF EXISTS sandlabx_labs CASCADE;
DROP FUNCTION IF EXISTS update_sandlabx_labs_modified();
DROP FUNCTION IF EXISTS update_sandlabx_nodes_modified();
`);

exports.down = false;
