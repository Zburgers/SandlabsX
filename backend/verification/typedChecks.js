'use strict';

const { CheckRegistry } = require('./checkRegistry');
const { EvidenceService } = require('./evidenceService');

const timeoutError = label => Object.assign(new Error(`Timed out waiting for ${label}`), { code: 'CHECK_TIMEOUT' });
const expected = (actual, wanted) => Object.entries(wanted || {}).every(([key, value]) => actual?.[key] === value);
const outputFor = (value, evidence) => {
  const { output, banner, ...observed } = value || {};
  return { observed, evidence: evidence.output(output ?? banner ?? '') };
};

function builtIns(evidence) {
  return {
    nodeReadiness: async (check, context) => ({ observed: context.nodes?.[check.node] || {}, passed: expected(context.nodes?.[check.node], check.expected) }),
    topology: async (check, context) => {
      const observed = { nodes: context.topology?.nodes?.length || 0, links: context.topology?.links?.length || 0 };
      return { observed, passed: expected(observed, check.expected) };
    },
    interfaceLink: async (check, context) => ({ observed: context.interfaces?.[check.target] || {}, passed: expected(context.interfaces?.[check.target], check.expected) }),
    ping: async (check, context) => {
      if (typeof context.ping !== 'function') throw Object.assign(new Error('Ping transport is unavailable'), { code: 'TRANSPORT_UNAVAILABLE' });
      const value = await context.ping(check);
      return { ...outputFor(value, evidence), passed: expected(value, check.expected) };
    },
    servicePort: async (check, context) => {
      if (typeof context.servicePort !== 'function') throw Object.assign(new Error('Service transport is unavailable'), { code: 'TRANSPORT_UNAVAILABLE' });
      const value = await context.servicePort(check);
      return { ...outputFor(value, evidence), passed: expected(value, check.expected) };
    },
    serialOutput: async (check, context) => {
      if (typeof context.readSerial !== 'function') throw Object.assign(new Error('Serial transport is unavailable'), { code: 'TRANSPORT_UNAVAILABLE' });
      const output = await context.readSerial(check.node, check);
      return { observed: {}, evidence: evidence.output(output), passed: evidence.redact(output).includes(String(check.expected?.contains || '')) };
    },
    artifactContent: async (check, context) => {
      if (typeof context.readArtifact !== 'function') throw Object.assign(new Error('Artifact store is unavailable'), { code: 'ARTIFACT_UNAVAILABLE' });
      const output = await context.readArtifact(check.artifact, check);
      return { observed: {}, evidence: evidence.output(output), passed: evidence.redact(output).includes(String(check.expected?.contains || '')) };
    }
  };
}

class TypedCheckRunner {
  constructor({ registry, evidenceService, maxEvidenceBytes = 65536, timeoutMs = 10000 } = {}) {
    this.evidence = evidenceService || new EvidenceService({ maxBytes: maxEvidenceBytes });
    this.timeoutMs = timeoutMs;
    this.registry = registry || new CheckRegistry(builtIns(this.evidence));
  }
  async runStage(stage, context = {}) {
    const results = [];
    for (const check of stage?.checks || []) results.push(await this.runCheck(check, context));
    const score = results.filter(result => result.status === 'PASSED').reduce((total, result) => total + result.score, 0);
    const maximumScore = results.reduce((total, result) => total + result.score, 0);
    return { status: results.every(result => result.status === 'PASSED') ? 'PASSED' : 'FAILED', score, maximumScore, results };
  }
  async runCheck(check, context) {
    const started = Date.now();
    if (!this.registry.get(check?.type)) throw Object.assign(new Error(`Unsupported typed check: ${check?.type || '(missing)'}`), { code: 'UNSUPPORTED_CHECK' });
    const attempts = Math.max(1, Number(check.retry?.attempts || 1));
    let last;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const value = await this.withTimeout(this.registry.run(check, context), check.timeoutMs || this.timeoutMs, check.id || check.type);
        last = this.result(check, value, started, attempt);
        if (last.status === 'PASSED' || attempt === attempts) return last;
      } catch (error) {
        last = this.failure(check, error, started, attempt);
        if (attempt === attempts) return last;
      }
      if (check.retry?.delayMs) await new Promise(resolve => setTimeout(resolve, check.retry.delayMs));
    }
    return last;
  }
  result(check, value, started, attempts) { return { id: check.id, type: check.type, status: value.passed ? 'PASSED' : 'FAILED', score: Number(check.score || 0), attempts, durationMs: Date.now() - started, expected: check.expected || {}, observed: value.observed || {}, evidence: value.evidence || {}, ...(value.passed || !check.hint ? {} : { hint: check.hint }) }; }
  failure(check, error, started, attempts) { return { id: check.id, type: check.type, status: 'ERROR', score: Number(check.score || 0), attempts, durationMs: Date.now() - started, expected: check.expected || {}, observed: {}, evidence: {}, error: { code: error.code || 'CHECK_ERROR', message: this.evidence.bound(error.message, 512) }, ...(check.hint ? { hint: check.hint } : {}) }; }
  async withTimeout(promise, timeoutMs, label) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError(label)), timeoutMs); })]); } finally { clearTimeout(timer); } }
}

module.exports = { TypedCheckRunner, builtIns };
