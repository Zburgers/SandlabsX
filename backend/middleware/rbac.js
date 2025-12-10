/**
 * RBAC Middleware - Role-Based Access Control
 * Feature Module 6.2 (PRD)
 * 
 * Roles: admin, instructor, student
 * - admin: Full access to all resources
 * - instructor: Create/manage own labs and nodes
 * - student: Start/stop own nodes, view assigned labs
 */

const { Pool } = require('pg');
const logger = require('../logger');

// Database pool for ownership checks
const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'guacamole_db',
    user: process.env.DB_USER || 'guacamole_user',
    password: process.env.DB_PASSWORD || 'guacamole_pass',
    max: 5,
    idleTimeoutMillis: 30000,
});

// Valid roles from database schema
const VALID_ROLES = ['admin', 'instructor', 'student'];

/**
 * Require user to have one of the specified roles
 * @param {string[]} allowedRoles - Array of roles that can access this route
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.role;

        if (!userRole) {
            logger.warn({ userId: req.user?.id }, 'RBAC: No role found for user');
            return res.status(403).json({
                success: false,
                error: 'User role not found',
                code: 'FORBIDDEN'
            });
        }

        // Admin can always access
        if (userRole === 'admin') {
            return next();
        }

        if (!allowedRoles.includes(userRole)) {
            logger.warn({
                userId: req.user?.id,
                role: userRole,
                required: allowedRoles
            }, 'RBAC: Insufficient permissions');

            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                required: allowedRoles
            });
        }

        next();
    };
};

/**
 * Require user to own the resource (or be admin)
 * @param {string} resourceType - 'labs' or 'nodes'
 */
const requireOwnership = (resourceType) => {
    const tableMap = {
        labs: 'sandlabx_labs',
        nodes: 'sandlabx_nodes'
    };

    return async (req, res, next) => {
        const resourceId = req.params.id;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // Admin bypasses ownership check
        if (userRole === 'admin') {
            return next();
        }

        if (!resourceId) {
            return res.status(400).json({
                success: false,
                error: 'Resource ID required',
                code: 'BAD_REQUEST'
            });
        }

        const tableName = tableMap[resourceType];
        if (!tableName) {
            logger.error({ resourceType }, 'RBAC: Invalid resource type');
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }

        try {
            const result = await pool.query(
                `SELECT user_id FROM ${tableName} WHERE id = $1`,
                [resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: `${resourceType.slice(0, -1)} not found`,
                    code: 'NOT_FOUND'
                });
            }

            const ownerId = result.rows[0].user_id;

            if (ownerId !== userId) {
                logger.warn({
                    userId,
                    resourceId,
                    ownerId,
                    resourceType
                }, 'RBAC: Access denied - not owner');

                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to access this resource',
                    code: 'FORBIDDEN'
                });
            }

            next();
        } catch (error) {
            logger.error({ err: error, resourceType, resourceId }, 'RBAC: Ownership check failed');
            return res.status(500).json({
                success: false,
                error: 'Failed to verify resource ownership',
                code: 'INTERNAL_ERROR'
            });
        }
    };
};

/**
 * Require user to own the lab OR lab is public (for read access)
 */
const requireLabAccess = () => {
    return async (req, res, next) => {
        const labId = req.params.id;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // Admin bypasses
        if (userRole === 'admin') {
            return next();
        }

        if (!labId) {
            return res.status(400).json({
                success: false,
                error: 'Lab ID required',
                code: 'BAD_REQUEST'
            });
        }

        try {
            const result = await pool.query(
                'SELECT user_id, is_public FROM sandlabx_labs WHERE id = $1',
                [labId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Lab not found',
                    code: 'NOT_FOUND'
                });
            }

            const { user_id: ownerId, is_public: isPublic } = result.rows[0];

            // Allow access if owner or public
            if (ownerId === userId || isPublic) {
                return next();
            }

            logger.warn({ userId, labId, ownerId }, 'RBAC: Lab access denied');
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to access this lab',
                code: 'FORBIDDEN'
            });
        } catch (error) {
            logger.error({ err: error, labId }, 'RBAC: Lab access check failed');
            return res.status(500).json({
                success: false,
                error: 'Failed to verify lab access',
                code: 'INTERNAL_ERROR'
            });
        }
    };
};

/**
 * Require user to own the node (for start/stop operations)
 * Students can start/stop their own nodes
 */
const requireNodeAccess = () => {
    return async (req, res, next) => {
        const nodeId = req.params.id;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // Admin and instructor bypass for any node operation
        if (userRole === 'admin') {
            return next();
        }

        if (!nodeId) {
            return res.status(400).json({
                success: false,
                error: 'Node ID required',
                code: 'BAD_REQUEST'
            });
        }

        try {
            const result = await pool.query(
                'SELECT user_id FROM sandlabx_nodes WHERE id = $1',
                [nodeId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Node not found',
                    code: 'NOT_FOUND'
                });
            }

            const ownerId = result.rows[0].user_id;

            // Instructors can access their own nodes
            if (userRole === 'instructor' && ownerId === userId) {
                return next();
            }

            // Students can only start/stop their own nodes
            if (userRole === 'student' && ownerId === userId) {
                return next();
            }

            logger.warn({ userId, nodeId, ownerId, role: userRole }, 'RBAC: Node access denied');
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to access this node',
                code: 'FORBIDDEN'
            });
        } catch (error) {
            logger.error({ err: error, nodeId }, 'RBAC: Node access check failed');
            return res.status(500).json({
                success: false,
                error: 'Failed to verify node access',
                code: 'INTERNAL_ERROR'
            });
        }
    };
};

/**
 * Middleware to enrich req.user with role from database
 * Call this after JWT auth middleware
 */
const enrichUserRole = async (req, res, next) => {
    if (!req.auth?.sub) {
        // No authenticated user, skip enrichment
        return next();
    }

    try {
        const result = await pool.query(
            'SELECT id, email, role FROM sandlabx_users WHERE id = $1',
            [req.auth.sub]
        );

        if (result.rows.length > 0) {
            req.user = {
                id: result.rows[0].id,
                email: result.rows[0].email,
                role: result.rows[0].role
            };
        } else {
            // User not found in DB - use default student role
            req.user = {
                id: req.auth.sub,
                email: req.auth.email,
                role: 'student'
            };
        }

        next();
    } catch (error) {
        logger.error({ err: error, userId: req.auth.sub }, 'Failed to enrich user role');
        // Continue with basic user info
        req.user = {
            id: req.auth.sub,
            role: 'student'
        };
        next();
    }
};

module.exports = {
    requireRole,
    requireOwnership,
    requireLabAccess,
    requireNodeAccess,
    enrichUserRole,
    VALID_ROLES
};
