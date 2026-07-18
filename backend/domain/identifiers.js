'use strict';

const crypto = require('node:crypto');

function stableId(namespace, value) {
  return crypto.createHash('sha256').update(`${namespace}:${value}`).digest('hex').slice(0, 32);
}

function assertIdentifier(value, field = 'identifier') {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(value)) {
    throw new Error(`${field} must be lowercase kebab-case`);
  }
  return value;
}

module.exports = { stableId, assertIdentifier };
