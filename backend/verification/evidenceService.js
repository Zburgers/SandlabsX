'use strict';

const SENSITIVE = /((?:password|secret|token|authorization|api[-_ ]?key)\s*[=:]\s*)(?:Bearer\s+)?[^\s,;]+/gi;

class EvidenceService {
  constructor({ maxBytes = 65536 } = {}) { this.maxBytes = maxBytes; }
  redact(value) { return String(value ?? '').replace(SENSITIVE, '$1[REDACTED]'); }
  bound(value, maxBytes = this.maxBytes) { return this.redact(value).slice(0, Math.max(0, maxBytes)); }
  output(value, maxBytes) { return { output: this.bound(value, maxBytes) }; }
}

module.exports = { EvidenceService };
