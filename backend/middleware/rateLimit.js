'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Use a stable authenticated account key when available. Anonymous requests
// fall back to the library's IPv6-safe subnet normalization.
const accountOrIpKeyGenerator = (req) => {
  if (req.user?.id) return `user:${req.user.id}`;
  return `ip:${ipKeyGenerator(req.ip)}`;
};

const ipOnlyKeyGenerator = (req) => `ip:${ipKeyGenerator(req.ip)}`;

// Standard response for rate limit exceeded.
const handler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    success: false,
    error: options.message,
    retryAfter: Math.ceil(options.windowMs / 1000),
  });
};

// 1. Create Node Limiter: 10 per hour
const createNodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Too many nodes created from this account, please try again after an hour',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: accountOrIpKeyGenerator,
  handler,
});

// 2. Start Node Limiter: 20 per hour
const startNodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: 'Too many node starts from this account, please try again after an hour',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: accountOrIpKeyGenerator,
  handler,
});

// 3. Upload Image Limiter: 5 per hour
const uploadImageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many image uploads from this account, please try again after an hour',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: accountOrIpKeyGenerator,
  handler,
});

// 4. Auth/Login Limiter: 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipOnlyKeyGenerator,
  handler,
});

module.exports = {
  createNodeLimiter,
  startNodeLimiter,
  uploadImageLimiter,
  authLimiter,
  accountOrIpKeyGenerator,
  ipOnlyKeyGenerator,
};
