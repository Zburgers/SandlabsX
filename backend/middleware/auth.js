const { expressjwt: jwt } = require('express-jwt');

// Public paths that don't require authentication
const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/health',
    { url: /^\/api\/docs/, methods: ['GET'] }
];

// Middleware to protect routes – expects Authorization: Bearer <token>
// Uses 'unless' to skip authentication for public paths
module.exports = jwt({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256']
}).unless({ path: publicPaths });
