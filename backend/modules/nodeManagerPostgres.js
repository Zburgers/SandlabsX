const { Client, Pool } = require('pg');
const path = require('path');

/**
 * NodeManager - PostgreSQL-backed node state management
 * Migrated from JSON file storage to PostgreSQL for better reliability and scalability
 */
class NodeManager {
  constructor() {
    // PostgreSQL connection pool
    this.pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'guacamole_db',
      user: process.env.DB_USER || 'guacamole_user',
      password: process.env.DB_PASSWORD || 'guacamole_pass',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const overlaysEnv = process.env.OVERLAYS_PATH;
    this.overlaysPath = overlaysEnv && overlaysEnv.length > 0
      ? overlaysEnv
      : path.join(__dirname, '..', '..', 'overlays');

    this.connected = false;
  }

  async initialize() {
    console.log('📊 Initializing PostgreSQL-backed NodeManager...');

    // Test connection
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const client = await this.pool.connect();
        const result = await client.query('SELECT COUNT(*) FROM sandlabx_nodes');
        console.log(`✅ Connected to PostgreSQL (${result.rows[0].count} existing nodes)`);
        client.release();
        this.connected = true;
        return;
      } catch (error) {
        if (attempt < 5) {
          const delay = attempt * 1000;
          console.log(`⚠️  Database connection attempt ${attempt}/5 failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ Failed to connect to PostgreSQL after 5 attempts');
          throw error;
        }
      }
    }
  }

  async createNode(name, osType = 'ubuntu', resources = {}, options = {}) {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const overlayPath = path.join(this.overlaysPath, `node_${id}.qcow2`);
    const image = options.image || null;

    const result = await this.pool.query(`
      INSERT INTO sandlabx_nodes (
        id, name, os_type, status, overlay_path,
        ram_mb, cpu_cores, image_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      id,
      name || `node-${id.substring(0, 8)}`,
      osType,
      'stopped',
      overlayPath,
      parseInt(resources.ram) || parseInt(process.env.QEMU_RAM) || 2048,
      parseInt(resources.cpus) || parseInt(process.env.QEMU_CPUS) || 2,
      JSON.stringify(image)
    ]);

    const node = this.dbRowToNode(result.rows[0]);
    console.log(`✅ Created node: ${node.name} (${id}) - ${node.osType} with ${node.resources.ram}MB RAM, ${node.resources.cpus} CPUs`);
    return node;
  }

  async getNode(id) {
    const result = await this.pool.query(
      'SELECT * FROM sandlabx_nodes WHERE id = $1',
      [id]
    );

    return result.rows.length > 0 ? this.dbRowToNode(result.rows[0]) : null;
  }

  async listNodes() {
    const result = await this.pool.query(
      'SELECT * FROM sandlabx_nodes ORDER BY created_at DESC'
    );

    return result.rows.map(row => this.dbRowToNode(row));
  }

  async updateNode(id, updates) {
    // Build dynamic UPDATE query
    const setters = [];
    const values = [];
    let paramIndex = 1;

    // Map frontend field names to database column names
    const fieldMapping = {
      vncPort: 'vnc_port',
      guacConnectionId: 'guac_connection_id',
      guacUrl: 'guac_url',
      startedAt: 'started_at',
      stoppedAt: 'stopped_at',
      wipedAt: 'wiped_at',
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbColumn = fieldMapping[key] || key;

      if (key === 'resources') {
        // Handle nested resources object
        if (value.ram !== undefined) {
          setters.push(`ram_mb = $${paramIndex++}`);
          values.push(value.ram);
        }
        if (value.cpus !== undefined) {
          setters.push(`cpu_cores = $${paramIndex++}`);
          values.push(value.cpus);
        }
      } else if (key === 'image') {
        setters.push(`image_metadata = $${paramIndex++}`);
        values.push(JSON.stringify(value));
      } else {
        setters.push(`${dbColumn} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (setters.length === 0) {
      return await this.getNode(id);
    }

    values.push(id);
    const query = `
      UPDATE sandlabx_nodes 
      SET ${setters.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Node not found');
    }

    return this.dbRowToNode(result.rows[0]);
  }

  async deleteNode(id) {
    const node = await this.getNode(id);
    if (!node) {
      throw new Error('Node not found');
    }

    await this.pool.query('DELETE FROM sandlabx_nodes WHERE id = $1', [id]);

    console.log(`🗑️  Deleted node: ${node.name} (${id})`);
    return true;
  }

  async getNextAvailableVncPort() {
    const startPort = parseInt(process.env.VNC_START_PORT) || 5900;

    const result = await this.pool.query(
      'SELECT vnc_port FROM sandlabx_nodes WHERE vnc_port IS NOT NULL ORDER BY vnc_port'
    );

    const usedPorts = new Set(result.rows.map(row => row.vnc_port));

    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
    }

    return port;
  }

  /**
   * Convert database row to node object (matches old JSON structure)
   */
  dbRowToNode(row) {
    return {
      id: row.id,
      name: row.name,
      osType: row.os_type,
      status: row.status,
      overlayPath: row.overlay_path,
      vncPort: row.vnc_port,
      guacConnectionId: row.guac_connection_id,
      guacUrl: row.guac_url,
      pid: row.pid,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
      wipedAt: row.wiped_at,
      image: row.image_metadata ? row.image_metadata : null,
      resources: {
        ram: row.ram_mb,
        cpus: row.cpu_cores
      }
    };
  }

  /**
   * Check database health
   */
  async checkHealth() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Health check failed (DB):', error.message);
      return false;
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    console.log('📊 Closing NodeManager database connections...');
    await this.pool.end();
  }
}

module.exports = { NodeManager };
