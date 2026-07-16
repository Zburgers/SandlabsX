const crypto = require('node:crypto');
const fs = require('node:fs').promises;
const path = require('node:path');

class VerificationError extends Error {
  constructor(message, code = 'VERIFICATION_ERROR') { super(message); this.name = 'VerificationError'; this.code = code; }
}

class VerificationRunner {
  constructor(options = {}) { this.timeoutMs = options.timeoutMs || 10000; this.maxOutputBytes = options.maxOutputBytes || 65536; }

  async run(scenario, context = {}) {
    const startedAt = new Date().toISOString();
    const results = [];
    for (const check of scenario.checks || []) results.push(await this.runCheck(check, context));
    return { scenarioId: scenario.id || null, status: results.every(result => result.status === 'PASSED') ? 'PASSED' : 'FAILED', startedAt, finishedAt: new Date().toISOString(), results };
  }

  async runCheck(check, context) {
    const started = Date.now();
    if (check.type === 'command') throw new VerificationError('Arbitrary command checks are disabled', 'UNSUPPORTED_CHECK');
    let observed;
    if (check.type === 'topologyPlan') {
      observed = { nodes: context.plan?.nodes?.length || 0, links: context.plan?.network?.segments?.length || 0 };
      return this.result(check, observed, observed.nodes === check.expected?.nodes && observed.links === check.expected?.links, started);
    }
    if (check.type === 'serialOutput') {
      observed = await this.withTimeout(Promise.resolve(context.readSerial?.(check.node)), `serial output for ${check.node}`);
      const output = this.bound(observed);
      const matched = output.includes(String(check.expected?.contains || ''));
      return this.result(check, { output: this.redact(output) }, matched, started);
    }
    if (check.type === 'fileContains') {
      const artifactsRoot = path.resolve(context.artifactsRoot || process.cwd());
      const target = path.resolve(artifactsRoot, check.path || '');
      if (target !== artifactsRoot && !target.startsWith(`${artifactsRoot}${path.sep}`)) throw new VerificationError('Artifact path must remain inside the instance artifact root', 'INVALID_ARTIFACT_PATH');
      const content = this.bound(await this.withTimeout(fs.readFile(target, 'utf8'), `artifact ${check.path}`));
      return this.result(check, { output: this.redact(content) }, content.includes(String(check.expected?.contains || '')), started);
    }
    throw new VerificationError(`Unsupported typed check: ${check.type || '(missing)'}`, 'UNSUPPORTED_CHECK');
  }

  result(check, observed, passed, started) {
    return { id: check.id, type: check.type, status: passed ? 'PASSED' : 'FAILED', durationMs: Date.now() - started, expected: check.expected || {}, observed, evidence: observed };
  }

  async withTimeout(promise, label) {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new VerificationError(`Timed out waiting for ${label}`, 'CHECK_TIMEOUT')), this.timeoutMs); })]);
    } finally { clearTimeout(timer); }
  }

  bound(value) { return String(value || '').slice(0, this.maxOutputBytes); }
  redact(value) { return value.replace(/((?:password|secret|token|authorization)\s*[=:]\s*)([^\s,;]+)/gi, '$1[REDACTED]'); }
}

module.exports = { VerificationError, VerificationRunner };
