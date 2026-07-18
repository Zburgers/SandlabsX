'use strict';
const { spawn } = require('node:child_process');
class ProcessRunner {
  constructor({ maxOutputBytes = 64 * 1024, spawnImpl = spawn } = {}) { this.maxOutputBytes = maxOutputBytes; this.spawnImpl = spawnImpl; }
  run(command, args, options = {}) { if (!Array.isArray(args) || typeof command !== 'string' || !command) throw new TypeError('command and argument array are required'); return new Promise((resolve, reject) => { const child = this.spawnImpl(command, args, { ...options, shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = ''; let stderr = ''; const collect = (target, chunk) => (target + String(chunk)).slice(-this.maxOutputBytes); child.stdout?.on('data', chunk => { stdout = collect(stdout, chunk); }); child.stderr?.on('data', chunk => { stderr = collect(stderr, chunk); }); child.once('error', reject); child.once('close', (code, signal) => resolve({ command, args: [...args], code, signal, stdout, stderr, correlationId: options.correlationId || null })); }); }
  spawn(command, args, options = {}) { if (!Array.isArray(args) || typeof command !== 'string' || !command) throw new TypeError('command and argument array are required'); return new Promise((resolve, reject) => { const child = this.spawnImpl(command, args, { ...options, shell: false, detached: false, stdio: 'ignore' }); child.once('error', reject); child.once('spawn', () => resolve({ pid: child.pid, command, args: [...args] })); }); }
}
module.exports = { ProcessRunner };
