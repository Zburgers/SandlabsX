'use strict';
const { Pool } = require('pg');

function createDatabase(config = {}) {
  const pool = config.pool || new Pool({ connectionString: config.connectionString || process.env.DATABASE_URL, max: config.max || 10 });
  return { pool, query: (...args) => pool.query(...args), healthcheck: () => pool.query('SELECT 1'), close: () => pool.end() };
}
async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; }
  finally { client.release(); }
}
module.exports = { createDatabase, withTransaction };
