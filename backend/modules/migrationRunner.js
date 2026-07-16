const fs = require('node:fs').promises;
const path = require('node:path');

async function runMigrations(pool, directory = path.join(__dirname, '..', 'migrations')) {
  await pool.query('CREATE TABLE IF NOT EXISTS sandlabx_schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const files = (await fs.readdir(directory)).filter(file => file.endsWith('.sql')).sort();
  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM sandlabx_schema_migrations WHERE version = $1', [file]);
    if (applied.rows.length) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await fs.readFile(path.join(directory, file), 'utf8'));
      await client.query('INSERT INTO sandlabx_schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
}

module.exports = { runMigrations };
