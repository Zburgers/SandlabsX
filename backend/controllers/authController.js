/**
 * Auth Controller - Public authentication endpoints
 * Handles Login and Registration
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const logger = require('../logger');
const { auditLogger } = require('../modules/auditLogger');

// Database pool (shared config)
const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'guacamole_db',
    user: process.env.DB_USER || 'guacamole_user',
    password: process.env.DB_PASSWORD || 'guacamole_pass',
    max: 5,
    idleTimeoutMillis: 30000,
});

// Hashing constants (Must match userController.js)
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';
const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set!

/**
 * Hash a password using PBKDF2
 */
const hashPassword = (password) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return `${salt}:${hash}`;
};

/**
 * Verify a password against a hash
 */
const verifyPassword = (password, storedHash) => {
    const [salt, originalHash] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return hash === originalHash;
};

/**
 * Generate JWT Token
 */
const generateToken = (user) => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
    }
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

/**
 * POST /api/auth/register
 * Register a new user (default role: student)
 */
const register = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email required' });
        }
        if (!password || password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        // Check duplicate
        const existing = await pool.query('SELECT id FROM sandlabx_users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Create user
        const id = uuidv4();
        const passwordHash = hashPassword(password);
        const role = 'student'; // Default role

        const result = await pool.query(`
            INSERT INTO sandlabx_users (id, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, role, created_at
        `, [id, email.toLowerCase(), passwordHash, role]);

        const user = result.rows[0];
        const token = generateToken(user);

        // Audit log
        await auditLogger.log(id, 'REGISTER', 'user', id, { email: user.email }, true);

        logger.info({ action: 'register', userId: user.id }, 'User registered');

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        logger.error({ err: error, action: 'register' }, 'Registration failed');
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
};

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        // Find user
        const result = await pool.query('SELECT * FROM sandlabx_users WHERE LOWER(email) = LOWER($1)', [email]);

        if (result.rows.length === 0) {
            // Audit failed login attempt (use email as resourceId if user not found)
            await auditLogger.log(null, 'LOGIN_FAILED', 'user', null, { email, reason: 'User not found' }, false);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        if (!verifyPassword(password, user.password_hash)) {
            await auditLogger.log(user.id, 'LOGIN_FAILED', 'user', user.id, { email, reason: 'Invalid password' }, false);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user);

        // Audit success
        await auditLogger.logLogin(user.id, user.email, req.ip);

        logger.info({ action: 'login', userId: user.id }, 'User logged in');

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        logger.error({ err: error, action: 'login' }, 'Login failed');
        res.status(500).json({ success: false, error: 'Login failed' });
    }
};

module.exports = { register, login };
