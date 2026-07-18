'use strict';

const { EvidenceService } = require('./evidenceService');

const fail = (message, code) => Object.assign(new Error(message), { code });
const MAX_LIMITS = { timeoutMs: 120000, maxOutputBytes: 65536, cpuMs: 60000 };

class GuestCommandCheck {
  constructor({ transport, audit, installedPlugins = new Set(), evidenceService } = {}) {
    this.transport = transport;
    this.audit = audit;
    this.installedPlugins = installedPlugins;
    this.evidence = evidenceService || new EvidenceService({ maxBytes: MAX_LIMITS.maxOutputBytes });
  }
  async run(check, { actor, instance } = {}) {
    this.validate(check, actor, instance);
    const limits = this.limits(check.limits);
    const targetVm = check.targetVm;
    const result = await this.transport.execute({ instanceId: instance.id, targetVm, argv: [...check.argv], limits });
    const output = this.evidence.bound(result?.output, limits.maxOutputBytes);
    const passed = Number(result?.exitCode ?? 0) === 0 && output.includes(String(check.expected?.contains || ''));
    const evidence = { output, exitCode: Number(result?.exitCode ?? 0) };
    await this.audit?.record?.({ action: 'scenario.guest-command.run', actorId: actor.id || actor.sub, instanceId: instance.id, targetVm, checkId: check.id, outcome: passed ? 'PASSED' : 'FAILED', metadata: { argvLength: check.argv.length, limits } });
    return { observed: { exitCode: evidence.exitCode }, evidence, passed };
  }
  validate(check, actor, instance) {
    if (!actor?.id && !actor?.sub) throw fail('Authentication is required', 'UNAUTHORIZED');
    if (!['admin', 'instructor'].includes(actor.role)) throw fail('Guest verification requires instructor access', 'FORBIDDEN');
    if (!instance?.id || !Array.isArray(instance.nodes)) throw fail('An owned lab instance is required', 'INSTANCE_OWNERSHIP_REQUIRED');
    if (!this.transport?.qualified || typeof this.transport.execute !== 'function') throw fail('A qualified guest transport is required', 'TRANSPORT_UNQUALIFIED');
    if (!Array.isArray(check?.argv) || !check.argv.length || check.argv.some(value => typeof value !== 'string' || !value.length)) throw fail('Guest commands require a non-empty argument array', 'INVALID_COMMAND');
    if (typeof check.targetVm !== 'string' || ['host', 'sandlabx-host'].includes(check.targetVm) || !instance.nodes.some(node => node.id === check.targetVm)) throw fail('Guest target must be an instance-owned VM', check.targetVm === 'host' || check.targetVm === 'sandlabx-host' ? 'INVALID_TARGET' : 'INSTANCE_OWNERSHIP_REQUIRED');
    if (check.module || check.modulePath) throw fail('Scenario module paths are forbidden', 'INVALID_PLUGIN');
    if (check.plugin && !this.installedPlugins.has(check.plugin)) throw fail('Verifier plugin is not installed', 'PLUGIN_NOT_INSTALLED');
  }
  limits(input = {}) {
    const limits = { timeoutMs: Number(input.timeoutMs || 10000), maxOutputBytes: Number(input.maxOutputBytes || 65536), cpuMs: Number(input.cpuMs || 1000) };
    for (const [name, maximum] of Object.entries(MAX_LIMITS)) if (!Number.isSafeInteger(limits[name]) || limits[name] < 1 || limits[name] > maximum) throw fail(`Invalid ${name}`, 'INVALID_LIMITS');
    return limits;
  }
}

module.exports = { GuestCommandCheck, MAX_LIMITS };
