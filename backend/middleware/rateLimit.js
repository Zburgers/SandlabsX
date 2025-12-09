const rateLimit = require('express-rate-limit');

// Helper to determine key for rate limiting (User ID if auth, IP if anon)
const keyGenerator = (req) => {
    const key = req.user ? req.user.id : req.ip;
    return key;
};

// Standard response for rate limit exceeded
const handler = (req, res, next, options) => {
    res.status(options.statusCode).json({
        success: false,
        error: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000)
    });
};

// 1. Create Node Limiter: 10 per hour
const createNodeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many nodes created from this account, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler
});

// 2. Start Node Limiter: 20 per hour
const startNodeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: 'Too many node starts from this account, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler
});

// 3. Upload Image Limiter: 5 per hour
const uploadImageLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many image uploads from this account, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler
});

// 4. Auth/Login Limiter: 10 attempts per 15 minutes (Brute force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many login attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip, // Always use IP for login attempts
    handler
});

module.exports = {
    createNodeLimiter,
    startNodeLimiter,
    uploadImageLimiter,
    authLimiter
};
