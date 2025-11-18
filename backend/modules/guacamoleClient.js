const { Client } = require('pg');

/**
 * GuacamoleClient - Manages Guacamole connections in PostgreSQL
 */
class GuacamoleClient {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'guacamole_db',
      user: process.env.DB_USER || 'guacamole',
      password: process.env.DB_PASSWORD || 'guacpass123',
    };
    
    // URL for browser access (must be localhost:8081 since that's where the host exposes Guacamole)
    this.guacBaseUrl = 'http://localhost:8081/guacamole';
    this.connected = false;
  }

  async initialize() {
    console.log('🔌 Initializing GuacamoleClient...');
    
    // Retry connection up to 10 times with progressive delay
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const client = new Client(this.dbConfig);
        await client.connect();
        
        const result = await client.query('SELECT COUNT(*) FROM guacamole_connection');
        console.log(`✅ Connected to Guacamole database (${result.rows[0].count} existing connections)`);
        
        await client.end();
        this.connected = true;
        return;
      } catch (error) {
        if (attempt < 10) {
          const delay = attempt * 1000;
          console.log(`⚠️  Database connection attempt ${attempt}/10 failed, retrying in ${delay}ms...`);
          console.error(`   Connection details: ${this.dbConfig.host}:${this.dbConfig.port}/${this.dbConfig.database}`);
          console.error(`   Error code: ${error.code}`);
          console.error(`   Error message: ${error.message || error.toString()}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('⚠️  Failed to connect to Guacamole database after 10 attempts');
          console.error(`   Host: ${this.dbConfig.host}:${this.dbConfig.port}`);
          console.error(`   Database: ${this.dbConfig.database}`);
          console.error(`   User: ${this.dbConfig.user}`);
          console.error(`   Error: ${error.message || error.toString()}`);
          console.error(`   Error code: ${error.code}`);
          console.error('   Connections will not be registered in Guacamole');
          this.connected = false;
        }
      }
    }
  }

  isConnected() {
    return this.connected;
  }

  /**
   * Register a new VNC connection in Guacamole
   */
  async registerConnection(node, vncPort) {
    if (!this.connected) {
      console.warn('⚠️  Database not connected, skipping Guacamole registration');
      return {
        id: null,
        url: null,
        pid: null
      };
    }

    console.log(`🔗 Registering Guacamole connection for node ${node.id}...`);
    
    const client = new Client(this.dbConfig);
    
    try {
      await client.connect();

      // Get the default entity (guacadmin user's entity)
      const entityResult = await client.query(
        'SELECT entity_id FROM guacamole_entity WHERE name = $1 AND type = $2',
        ['guacadmin', 'USER']
      );

      if (entityResult.rows.length === 0) {
        throw new Error('Default guacadmin entity not found');
      }

      const entityId = entityResult.rows[0].entity_id;

      // Insert connection
      const connectionName = node.name || `Node ${node.id.substring(0, 8)}`;
      const insertConnectionResult = await client.query(
        `INSERT INTO guacamole_connection (connection_name, protocol, parent_id)
         VALUES ($1, $2, NULL)
         RETURNING connection_id`,
        [connectionName, 'vnc']
      );

      const connectionId = insertConnectionResult.rows[0].connection_id;
      console.log(`  Created connection ID: ${connectionId}`);

      // Insert VNC parameters
      // VNC host: use the backend container name since QEMU runs in the backend container
      // and guacd needs to connect to it via the Docker network
      const vncHost = process.env.VNC_HOST || 'sandlabx-backend';
      const parameters = [
        { name: 'hostname', value: vncHost },
        { name: 'port', value: String(vncPort) },
        { name: 'password', value: '' }, // No VNC password
        { name: 'color-depth', value: '16' },
        { name: 'cursor', value: 'remote' },
        { name: 'read-only', value: 'false' },
        { name: 'enable-audio', value: 'false' },
      ];

      for (const param of parameters) {
        await client.query(
          `INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
           VALUES ($1, $2, $3)`,
          [connectionId, param.name, param.value]
        );
      }

      console.log(`  Added VNC parameters: ${vncHost}:${vncPort}`);

      // Grant permission to guacadmin
      await client.query(
        `INSERT INTO guacamole_connection_permission (entity_id, connection_id, permission)
         VALUES ($1, $2, $3)`,
        [entityId, connectionId, 'READ']
      );

      console.log(`  Granted READ permission to guacadmin`);

      // Generate Guacamole URL
      // Format: http://localhost:8081/guacamole/#/client/<base64-encoded-connection-info>
      // For simplicity, we'll use the connection_id
      const connectionToken = Buffer.from(
        `${connectionId}\0c\0postgresql`
      ).toString('base64');
      
      const guacUrl = `${this.guacBaseUrl}/#/client/${connectionToken}`;

      await client.end();

      console.log(`✅ Guacamole connection registered: ${guacUrl}`);

      return {
        id: connectionId,
        url: guacUrl,
        pid: null // We don't track PID here, it's in qemuManager
      };
    } catch (error) {
      await client.end();
      console.error('Error registering Guacamole connection:', error);
      throw new Error(`Failed to register Guacamole connection: ${error.message}`);
    }
  }

  /**
   * Unregister a connection from Guacamole
   */
  async unregisterConnection(connectionId) {
    if (!this.connected || !connectionId) {
      return;
    }

    console.log(`🔌 Unregistering Guacamole connection ${connectionId}...`);
    
    const client = new Client(this.dbConfig);
    
    try {
      await client.connect();

      // Delete connection (cascades to parameters and permissions)
      await client.query(
        'DELETE FROM guacamole_connection WHERE connection_id = $1',
        [connectionId]
      );

      await client.end();
      
      console.log(`✅ Guacamole connection ${connectionId} unregistered`);
    } catch (error) {
      await client.end();
      console.error('Error unregistering Guacamole connection:', error);
      // Don't throw, this is not critical
    }
  }

  /**
   * List all Guacamole connections
   */
  async listConnections() {
    if (!this.connected) {
      return [];
    }

    const client = new Client(this.dbConfig);
    
    try {
      await client.connect();

      const result = await client.query(
        `SELECT connection_id, connection_name, protocol, parent_id
         FROM guacamole_connection
         ORDER BY connection_id DESC`
      );

      await client.end();
      
      return result.rows;
    } catch (error) {
      await client.end();
      console.error('Error listing Guacamole connections:', error);
      return [];
    }
  }
}

module.exports = { GuacamoleClient };
