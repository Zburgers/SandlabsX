'use strict';

class CheckRegistry {
  constructor(checks = {}) { this.checks = new Map(Object.entries(checks)); }
  register(type, check) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(type) || typeof check !== 'function') throw new TypeError('A check type and handler are required');
    this.checks.set(type, check);
    return this;
  }
  get(type) { return this.checks.get(type); }
  async run(check, context) {
    const handler = this.get(check?.type);
    if (!handler) throw Object.assign(new Error(`Unsupported typed check: ${check?.type || '(missing)'}`), { code: 'UNSUPPORTED_CHECK' });
    return handler(check, context);
  }
}

module.exports = { CheckRegistry };
