const pino = require('pino');

// Create logger with JSON output (pretty print in development)
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    base: {
        service: 'sandboxlabs-backend',
        version: '1.0.0'
    }
});

// Create child logger with context
logger.child = logger.child.bind(logger);

module.exports = logger;
