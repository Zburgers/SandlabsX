/**
 * User Controller - Admin user management
 * Feature Module 6.2 (PRD)
 * 
 * Admin-only endpoints for managing users and roles
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

// Database pool
const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'guacamole_db',
    user: process.env.DB_USER || 'guacamole_user',
    password: process.env.DB_PASSWORD || 'guacamole_pass',
    max: 5,
    idleTimeoutMillis: 30000,
});

const VALID_ROLES = ['admin', 'instructor', 'student'];
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2
 * @param {string} password - Plain text password
 * @returns {string} Hash in format salt:hash
 */
const hashPassword = (password) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return `${salt}:${hash}`;
};

/**
 * List all users (admin only)
 * GET /api/users
 */
const listUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        const roleFilter = req.query.role;

        let whereClause = '';
        const values = [];
        let paramIndex = 1;

        if (roleFilter && VALID_ROLES.includes(roleFilter)) {
            whereClause = `WHERE role = $${paramIndex++}`;
            values.push(roleFilter);
        }

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM sandlabx_users ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count);

        // Get users
        const result = await pool.query(`
            SELECT id, email, role, created_at
            FROM sandlabx_users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...values, limit, offset]);

        const users = result.rows.map(row => ({
            id: row.id,
            email: row.email,
            role: row.role,
            createdAt: row.created_at
        }));

        logger.info({ action: 'listUsers', userId: req.user?.id, count: users.length }, 'Listed users');

        res.json({
            success: true,
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error({ err: error, action: 'listUsers' }, 'Failed to list users');
        res.status(500).json({
            success: false,
            error: 'Failed to list users',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get a single user by ID
 * GET /api/users/:id
 */
const getUser = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT id, email, role, created_at FROM sandlabx_users WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'NOT_FOUND'
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        logger.error({ err: error, action: 'getUser' }, 'Failed to get user');
        res.status(500).json({
            success: false,
            error: 'Failed to get user',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Create a new user (admin only)
 * POST /api/users
 */
const createUser = async (req, res) => {
    try {
        const { email, password, role = 'student' } = req.body;

        // Validate email
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                error: 'Valid email is required',
                code: 'VALIDATION_ERROR'
            });
        }

        // Validate password
        if (!password || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters',
                code: 'VALIDATION_ERROR'
            });
        }

        // Validate role
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                error: `Role must be one of: ${VALID_ROLES.join(', ')}`,
                code: 'VALIDATION_ERROR'
            });
        }

        // Check for duplicate email
        const existing = await pool.query(
            'SELECT id FROM sandlabx_users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'A user with this email already exists',
                code: 'DUPLICATE_EMAIL'
            });
        }

        // Hash password using PBKDF2
        const passwordHash = hashPassword(password);

        // Create user
        const id = uuidv4();
        const result = await pool.query(`
            INSERT INTO sandlabx_users (id, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, role, created_at
        `, [id, email.toLowerCase(), passwordHash, role]);

        const user = result.rows[0];

        logger.info({
            action: 'createUser',
            adminId: req.user?.id,
            newUserId: user.id,
            email: user.email,
            role: user.role
        }, 'Created user');

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        logger.error({ err: error, action: 'createUser' }, 'Failed to create user');
        res.status(500).json({
            success: false,
            error: 'Failed to create user',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Update a user's role (admin only)
 * PATCH /api/users/:id/role
 */
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Validate role
        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                error: `Role must be one of: ${VALID_ROLES.join(', ')}`,
                code: 'VALIDATION_ERROR'
            });
        }

        // Check user exists
        const existing = await pool.query(
            'SELECT id, email, role FROM sandlabx_users WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'NOT_FOUND'
            });
        }

        // Prevent demoting self (admin protection)
        if (id === req.user?.id && role !== 'admin') {
            return res.status(400).json({
                success: false,
                error: 'Cannot change your own role',
                code: 'FORBIDDEN'
            });
        }

        // Update role
        const result = await pool.query(`
            UPDATE sandlabx_users 
            SET role = $1
            WHERE id = $2
            RETURNING id, email, role, created_at
        `, [role, id]);

        const user = result.rows[0];

        logger.info({
            action: 'updateUserRole',
            adminId: req.user?.id,
            userId: id,
            oldRole: existing.rows[0].role,
            newRole: role
        }, 'Updated user role');

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        logger.error({ err: error, action: 'updateUserRole' }, 'Failed to update user role');
        res.status(500).json({
            success: false,
            error: 'Failed to update user role',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Delete a user (admin only)
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.user?.id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account',
                code: 'FORBIDDEN'
            });
        }

        // Check user exists
        const existing = await pool.query(
            'SELECT id, email FROM sandlabx_users WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'NOT_FOUND'
            });
        }

        // Delete user (cascades to labs via FK)
        await pool.query('DELETE FROM sandlabx_users WHERE id = $1', [id]);

        logger.info({
            action: 'deleteUser',
            adminId: req.user?.id,
            deletedUserId: id,
            deletedEmail: existing.rows[0].email
        }, 'Deleted user');

        res.json({
            success: true,
            message: 'User deleted',
            id
        });
    } catch (error) {
        logger.error({ err: error, action: 'deleteUser' }, 'Failed to delete user');
        res.status(500).json({
            success: false,
            error: 'Failed to delete user',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Get current user profile
 * GET /api/users/me
 */
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
                code: 'UNAUTHORIZED'
            });
        }

        const result = await pool.query(
            'SELECT id, email, role, created_at FROM sandlabx_users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'NOT_FOUND'
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        logger.error({ err: error, action: 'getCurrentUser' }, 'Failed to get current user');
        res.status(500).json({
            success: false,
            error: 'Failed to get user profile',
            code: 'INTERNAL_ERROR'
        });
    }
};

module.exports = {
    listUsers,
    getUser,
    createUser,
    updateUserRole,
    deleteUser,
    getCurrentUser
};
