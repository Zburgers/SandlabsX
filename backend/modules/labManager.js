const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

/**
 * LabManager - PostgreSQL-backed lab management
 * Handles CRUD operations for labs (topology persistence)
 */
class LabManager {
    constructor() {
        // PostgreSQL connection pool (same config as nodeManagerPostgres)
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

        this.connected = false;
    }

    async initialize() {
        logger.info('📊 Initializing LabManager...');

        // Test connection
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                const client = await this.pool.connect();
                const result = await client.query('SELECT COUNT(*) FROM sandlabx_labs');
                logger.info(`✅ LabManager connected to PostgreSQL (${result.rows[0].count} existing labs)`);
                client.release();
                this.connected = true;
                return;
            } catch (error) {
                if (attempt < 5) {
                    const delay = attempt * 1000;
                    logger.warn(`⚠️  LabManager connection attempt ${attempt}/5 failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    logger.error('❌ LabManager failed to connect to PostgreSQL after 5 attempts');
                    throw error;
                }
            }
        }
    }

    /**
     * Validate topology JSON structure
     * @param {Object} topology - The topology object to validate
     * @returns {{ valid: boolean, error: string|null }}
     */
    validateTopology(topology) {
        if (!topology || typeof topology !== 'object') {
            return { valid: false, error: 'topologyJson must be an object' };
        }

        if (!Array.isArray(topology.nodes)) {
            return { valid: false, error: 'topologyJson.nodes must be an array' };
        }

        if (!Array.isArray(topology.edges)) {
            return { valid: false, error: 'topologyJson.edges must be an array' };
        }

        // Validate each node has required fields
        for (const node of topology.nodes) {
            if (!node.id) {
                return { valid: false, error: 'Each node must have an id' };
            }
        }

        // Validate each edge has source and target
        for (const edge of topology.edges) {
            if (!edge.source || !edge.target) {
                return { valid: false, error: 'Each edge must have source and target' };
            }
        }

        return { valid: true, error: null };
    }

    /**
     * Create a new lab
     * @param {string} userId - Owner's user ID
     * @param {Object} labData - Lab data { name, description, templateName, topologyJson, isPublic }
     * @returns {Object} Created lab object
     */
    async createLab(userId, labData) {
        const { name, description, templateName, topologyJson, isPublic = false } = labData;

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            const error = new Error('Lab name is required');
            error.statusCode = 400;
            throw error;
        }

        if (name.length > 255) {
            const error = new Error('Lab name must be 255 characters or less');
            error.statusCode = 400;
            throw error;
        }

        // Validate topology
        const topology = topologyJson || { nodes: [], edges: [] };
        const validation = this.validateTopology(topology);
        if (!validation.valid) {
            const error = new Error(validation.error);
            error.statusCode = 400;
            throw error;
        }

        // Check for duplicate name for this user
        const existingLab = await this.pool.query(
            'SELECT id FROM sandlabx_labs WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
            [userId, name.trim()]
        );

        if (existingLab.rows.length > 0) {
            const error = new Error('A lab with this name already exists');
            error.statusCode = 400;
            error.code = 'DUPLICATE_NAME';
            throw error;
        }

        const id = uuidv4();

        const result = await this.pool.query(`
      INSERT INTO sandlabx_labs (
        id, name, user_id, topology_json, template_name, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
            id,
            name.trim(),
            userId,
            JSON.stringify(topology),
            templateName || null,
            isPublic
        ]);

        const lab = this.dbRowToLab(result.rows[0]);
        logger.info({ labId: lab.id, userId, name: lab.name }, 'Created lab');
        return lab;
    }

    /**
     * List labs for a user with pagination and filters
     * @param {string} userId - User ID to filter by
     * @param {Object} filters - { page, limit, templateName, isPublic }
     * @returns {{ labs: Array, pagination: Object }}
     */
    async getLabs(userId, filters = {}) {
        const page = Math.max(1, parseInt(filters.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
        const offset = (page - 1) * limit;

        // Build WHERE clause
        const conditions = ['user_id = $1'];
        const values = [userId];
        let paramIndex = 2;

        if (filters.templateName) {
            conditions.push(`template_name = $${paramIndex++}`);
            values.push(filters.templateName);
        }

        // Include public labs if requested
        if (filters.isPublic === true || filters.isPublic === 'true') {
            conditions[0] = `(user_id = $1 OR is_public = TRUE)`;
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM sandlabx_labs WHERE ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count);

        // Get labs with pagination
        const result = await this.pool.query(`
      SELECT 
        id, name, user_id, template_name, is_public, 
        created_at, updated_at,
        jsonb_array_length(COALESCE(topology_json->'nodes', '[]'::jsonb)) as node_count,
        jsonb_array_length(COALESCE(topology_json->'edges', '[]'::jsonb)) as connection_count
      FROM sandlabx_labs 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...values, limit, offset]);

        const labs = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            userId: row.user_id,
            templateName: row.template_name,
            nodeCount: parseInt(row.node_count) || 0,
            connectionCount: parseInt(row.connection_count) || 0,
            isPublic: row.is_public,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        return {
            labs,
            pagination: {
                page,
                limit,
                total
            }
        };
    }

    /**
     * Get a single lab by ID
     * @param {string} labId - Lab ID
     * @param {string} userId - Requesting user's ID (for ownership check)
     * @returns {Object|null} Lab object or null if not found/forbidden
     */
    async getLab(labId, userId) {
        const result = await this.pool.query(
            'SELECT * FROM sandlabx_labs WHERE id = $1',
            [labId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const lab = result.rows[0];

        // Check if user can access this lab (owner or public)
        if (lab.user_id !== userId && !lab.is_public) {
            const error = new Error('You do not have permission to access this lab');
            error.statusCode = 403;
            throw error;
        }

        return this.dbRowToLab(lab);
    }

    /**
     * Update a lab
     * @param {string} labId - Lab ID to update
     * @param {string} userId - Requesting user's ID (for ownership check)
     * @param {Object} updates - Fields to update { name, description, topologyJson, isPublic }
     * @returns {Object} Updated lab object
     */
    async updateLab(labId, userId, updates) {
        // First check if lab exists and user owns it
        const existing = await this.pool.query(
            'SELECT * FROM sandlabx_labs WHERE id = $1',
            [labId]
        );

        if (existing.rows.length === 0) {
            const error = new Error('Lab not found');
            error.statusCode = 404;
            throw error;
        }

        if (existing.rows[0].user_id !== userId) {
            const error = new Error('You do not have permission to update this lab');
            error.statusCode = 403;
            throw error;
        }

        // Build dynamic UPDATE query
        const setters = [];
        const values = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            if (typeof updates.name !== 'string' || updates.name.trim().length === 0) {
                const error = new Error('Lab name cannot be empty');
                error.statusCode = 400;
                throw error;
            }
            if (updates.name.length > 255) {
                const error = new Error('Lab name must be 255 characters or less');
                error.statusCode = 400;
                throw error;
            }

            // Check for duplicate name (exclude current lab)
            const duplicateCheck = await this.pool.query(
                'SELECT id FROM sandlabx_labs WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
                [userId, updates.name.trim(), labId]
            );
            if (duplicateCheck.rows.length > 0) {
                const error = new Error('A lab with this name already exists');
                error.statusCode = 400;
                error.code = 'DUPLICATE_NAME';
                throw error;
            }

            setters.push(`name = $${paramIndex++}`);
            values.push(updates.name.trim());
        }

        if (updates.topologyJson !== undefined) {
            const validation = this.validateTopology(updates.topologyJson);
            if (!validation.valid) {
                const error = new Error(validation.error);
                error.statusCode = 400;
                throw error;
            }
            setters.push(`topology_json = $${paramIndex++}`);
            values.push(JSON.stringify(updates.topologyJson));
        }

        if (updates.templateName !== undefined) {
            setters.push(`template_name = $${paramIndex++}`);
            values.push(updates.templateName);
        }

        if (updates.isPublic !== undefined) {
            setters.push(`is_public = $${paramIndex++}`);
            values.push(Boolean(updates.isPublic));
        }

        if (setters.length === 0) {
            // No updates, return existing lab
            return this.dbRowToLab(existing.rows[0]);
        }

        values.push(labId);
        const result = await this.pool.query(`
      UPDATE sandlabx_labs 
      SET ${setters.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

        const lab = this.dbRowToLab(result.rows[0]);
        logger.info({ labId: lab.id, userId }, 'Updated lab');
        return lab;
    }

    /**
     * Delete a lab
     * @param {string} labId - Lab ID to delete
     * @param {string} userId - Requesting user's ID (for ownership check)
     * @returns {{ success: boolean, message: string, id: string }}
     */
    async deleteLab(labId, userId) {
        // First check if lab exists and user owns it
        const existing = await this.pool.query(
            'SELECT * FROM sandlabx_labs WHERE id = $1',
            [labId]
        );

        if (existing.rows.length === 0) {
            const error = new Error('Lab not found');
            error.statusCode = 404;
            throw error;
        }

        if (existing.rows[0].user_id !== userId) {
            const error = new Error('You do not have permission to delete this lab');
            error.statusCode = 403;
            throw error;
        }

        await this.pool.query('DELETE FROM sandlabx_labs WHERE id = $1', [labId]);

        logger.info({ labId, userId }, 'Deleted lab');
        return {
            success: true,
            message: 'Lab deleted',
            id: labId
        };
    }

    /**
     * Convert database row to lab object (snake_case to camelCase)
     */
    dbRowToLab(row) {
        return {
            id: row.id,
            name: row.name,
            userId: row.user_id,
            topologyJson: row.topology_json,
            templateName: row.template_name,
            isPublic: row.is_public,
            createdAt: row.created_at,
            updatedAt: row.updated_at
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
            logger.error({ err: error }, 'LabManager health check failed');
            return false;
        }
    }

    /**
     * Cleanup on shutdown
     */
    async shutdown() {
        logger.info('📊 Closing LabManager database connections...');
        await this.pool.end();
    }
}

module.exports = { LabManager };
