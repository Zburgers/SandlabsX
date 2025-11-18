#!/usr/bin/env node

/**
 * Migration script: Migrate nodes from JSON file to PostgreSQL
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'guacamole_db',
  user: process.env.DB_USER || 'guacamole_user',
  password: process.env.DB_PASSWORD || 'guacamole_pass',
};

const STATE_FILE = process.env.STATE_FILE || '/app/data/nodes-state.json';

async function migrateNodesToPostgres() {
  console.log('🔄 Starting migration: JSON → PostgreSQL');
  
  // Read JSON state
  let jsonData;
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    jsonData = JSON.parse(data);
    console.log(`📂 Found ${jsonData.nodes?.length || 0} nodes in JSON file`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📝 No JSON state file found, nothing to migrate');
      return;
    }
    throw error;
  }

  if (!jsonData.nodes || jsonData.nodes.length === 0) {
    console.log('✅ No nodes to migrate');
    return;
  }

  // Connect to PostgreSQL
  const client = new Client(dbConfig);
  await client.connect();
  console.log('✅ Connected to PostgreSQL');

  try {
    // Start transaction
    await client.query('BEGIN');

    let inserted = 0;
    let skipped = 0;

    for (const node of jsonData.nodes) {
      try {
        // Check if node already exists
        const existsResult = await client.query(
          'SELECT id FROM sandlabx_nodes WHERE id = $1',
          [node.id]
        );

        if (existsResult.rows.length > 0) {
          console.log(`⏭️  Skipping node ${node.name} (${node.id}) - already exists`);
          skipped++;
          continue;
        }

        // Insert node
        await client.query(`
          INSERT INTO sandlabx_nodes (
            id, name, os_type, status, overlay_path,
            vnc_port, guac_connection_id, guac_url, pid,
            ram_mb, cpu_cores, image_metadata,
            created_at, updated_at, started_at, stopped_at, wiped_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16, $17
          )
        `, [
          node.id,
          node.name,
          node.osType || node.os || 'ubuntu',
          node.status || 'stopped',
          node.overlayPath,
          node.vncPort,
          node.guacConnectionId,
          node.guacUrl,
          node.pid,
          node.resources?.ram || 2048,
          node.resources?.cpus || 2,
          JSON.stringify(node.image || null),
          node.createdAt || new Date().toISOString(),
          node.updatedAt || new Date().toISOString(),
          node.startedAt,
          node.stoppedAt,
          node.wipedAt
        ]);

        console.log(`✅ Migrated node: ${node.name} (${node.id})`);
        inserted++;
      } catch (nodeError) {
        console.error(`❌ Error migrating node ${node.id}:`, nodeError.message);
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('');
    console.log('📊 Migration Summary:');
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Total:    ${inserted + skipped}`);
    console.log('');
    console.log('✅ Migration complete!');
    console.log('💡 Note: JSON file still exists as backup - you can delete it manually if desired');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration
migrateNodesToPostgres().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
