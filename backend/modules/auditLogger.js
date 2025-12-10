const { Pool } = require('pg');
const logger = require('../logger');

/**
 * AuditLogger - Centralized audit logging for security and compliance
 * 
 * Logs all state-changing operations to sandlabx_audit_log table.
 * PRD Reference: Section 6 (Security & Multi-Tenancy)
 * 
 * Actions logged:
 * - CREATE_NODE, START_VM, STOP_VM, WIPE_VM, DELETE_NODE
 * - CREATE_LAB, DELETE_LAB, EXPORT_LAB, IMPORT_LAB
 * - UPLOAD_IMAGE, DELETE_IMAGE
 * - UPDATE_USER, LOGIN, LOGOUT
 */
class AuditLogger {
    constructor() {
        // PostgreSQL connection pool (shared config)
        this.pool = new Pool({
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'guacamole_db',
            user: process.env.DB_USER || 'guacamole_user',
            password: process.env.DB_PASSWORD || 'guacamole_pass',
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.connected = false;
    }

    async initialize() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT 1 FROM sandlabx_audit_log LIMIT 1');
            client.release();
            this.connected = true;
            logger.info('✅ AuditLogger initialized');
        } catch (error) {
            logger.warn({ err: error }, '⚠️ AuditLogger initialization failed - logging disabled');
            this.connected = false;
        }
    }

    /**
     * Log an action to the audit table
     * 
     * @param {string} userId - UUID of the user performing action (null for system)
     * @param {string} action - Action type (CREATE_NODE, START_VM, etc.)
     * @param {string} resourceType - Resource type (node, lab, image, user)
     * @param {string} resourceId - UUID of the affected resource
     * @param {Object} details - Additional context (JSON)
     * @param {boolean} success - Whether operation succeeded
     * @returns {number|null} Audit log entry ID or null on failure
     */
    async log(userId, action, resourceType, resourceId, details = {}, success = true) {
        if (!this.connected) {
            logger.debug({ action, resourceType, resourceId }, 'Audit logging skipped (not connected)');
            return null;
        }

        try {
            const result = await this.pool.query(`
                INSERT INTO sandlabx_audit_log (
                    user_id, action, resource_type, resource_id, details, success
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `, [
                userId || null,
                action,
                resourceType || null,
                resourceId || null,
                JSON.stringify(details),
                success
            ]);

            const logId = result.rows[0].id;
            logger.debug({ logId, action, resourceId, success }, 'Audit log entry created');
            return logId;
        } catch (error) {
            // Don't let audit failures break the main operation
            logger.error({ err: error, action, resourceType }, 'Failed to write audit log');
            return null;
        }
    }

    // Convenience methods for common actions

    async logNodeCreate(userId, nodeId, nodeName, osType) {
        return this.log(userId, 'CREATE_NODE', 'node', nodeId, { name: nodeName, osType });
    }

    async logNodeStart(userId, nodeId, nodeName) {
        return this.log(userId, 'START_VM', 'node', nodeId, { name: nodeName });
    }

    async logNodeStop(userId, nodeId, nodeName) {
        return this.log(userId, 'STOP_VM', 'node', nodeId, { name: nodeName });
    }

    async logNodeWipe(userId, nodeId, nodeName) {
        return this.log(userId, 'WIPE_VM', 'node', nodeId, { name: nodeName });
    }

    async logNodeDelete(userId, nodeId, nodeName) {
        return this.log(userId, 'DELETE_NODE', 'node', nodeId, { name: nodeName });
    }

    async logLabCreate(userId, labId, labName) {
        return this.log(userId, 'CREATE_LAB', 'lab', labId, { name: labName });
    }

    async logLabDelete(userId, labId, labName) {
        return this.log(userId, 'DELETE_LAB', 'lab', labId, { name: labName });
    }

    async logLabExport(userId, labId, labName) {
        return this.log(userId, 'EXPORT_LAB', 'lab', labId, { name: labName });
    }

    async logLabImport(userId, labId, labName, nodeCount) {
        return this.log(userId, 'IMPORT_LAB', 'lab', labId, { name: labName, nodeCount });
    }

    async logLabStart(userId, labId, labName, nodeCount) {
        return this.log(userId, 'START_LAB', 'lab', labId, { name: labName, nodeCount });
    }

    async logLabStop(userId, labId, labName, nodeCount) {
        return this.log(userId, 'STOP_LAB', 'lab', labId, { name: labName, nodeCount });
    }

    async logImageUpload(userId, imageId, imageName, sizeGb) {
        return this.log(userId, 'UPLOAD_IMAGE', 'image', imageId, { name: imageName, sizeGb });
    }

    async logImageDelete(userId, imageId, imageName) {
        return this.log(userId, 'DELETE_IMAGE', 'image', imageId, { name: imageName });
    }

    async logLogin(userId, email, ipAddress) {
        return this.log(userId, 'LOGIN', 'user', userId, { email, ipAddress });
    }

    async logLogout(userId, email) {
        return this.log(userId, 'LOGOUT', 'user', userId, { email });
    }

    /**
     * Query recent audit entries for a user
     * @param {string} userId - User UUID to query
     * @param {number} limit - Max entries to return
     * @returns {Array} Audit log entries
     */
    async getRecentLogs(userId, limit = 50) {
        try {
            const result = await this.pool.query(`
                SELECT id, action, resource_type, resource_id, details, success, created_at
                FROM sandlabx_audit_log
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `, [userId, limit]);

            return result.rows;
        } catch (error) {
            logger.error({ err: error }, 'Failed to query audit logs');
            return [];
        }
    }

    async shutdown() {
        await this.pool.end();
        logger.info('📊 AuditLogger connections closed');
    }
}

// Singleton instance
const auditLogger = new AuditLogger();

module.exports = { AuditLogger, auditLogger };
