'use strict';
const fs = require('node:fs');
const path = require('node:path');
function files(root) {
  const executableRoots = ['backend/app.js', 'backend/server.js', 'backend/swagger.js', 'backend/controllers', 'backend/middleware', 'backend/routes', 'backend/services', 'backend/repositories', 'backend/platform', 'backend/runner', 'backend/runtime', 'backend/planning', 'backend/modules'];
  const ignoredDirectories = new Set(['node_modules', '.git', '.next', 'test', 'graphify-out', 'docs', 'archive', 'scripts', 'cli']);
  const out = [];
  for (const directory of executableRoots) {
    const start = path.join(root, directory);
    if (!fs.existsSync(start)) continue;
    if (fs.statSync(start).isDirectory()) walk(start, out, ignoredDirectories); else out.push(start);
  }
  return out;
}
function walk(root, out, ignoredDirectories) { for (const entry of fs.readdirSync(root, { withFileTypes: true })) { if (ignoredDirectories.has(entry.name) || entry.name.startsWith('.')) continue; const full = path.join(root, entry.name); if (entry.isDirectory()) walk(full, out, ignoredDirectories); else if (/\.(js|cjs|ts|tsx)$/.test(entry.name) || entry.name === 'qemuManager.js.backup') out.push(full); } }
function checkArchitecture({ root, mode = 'inventory' }) {
  const categories = { legacyImports: /(?:LabManager|nodeManagerPostgres)/, legacyRoutes: /\/api\/(?:labs|nodes)\b/, legacyTopology: /nodes\[\]\s*\+\s*edges\[\]|topologyJson|\.topology_json/, fixedNetwork: /\b(?:PC1|PC2|tap[0-9]+)\b/, shellExecution: /\b(?:exec|execAsync)\s*\(|shell\s*:\s*true/, backupFiles: null, directConsole: /\bconsole\.(?:log|warn|error|debug)\s*\(/, directHostMutation: /(?:ip\s+link|brctl|qemu-system|spawn\s*\()/ };
  const report = Object.fromEntries(Object.keys(categories).map((key) => [key, []]));
  for (const file of files(root)) {
    const source = fs.readFileSync(file, 'utf8'); const rel = path.relative(root, file);
    for (const [key, pattern] of Object.entries(categories)) {
      if (rel === 'backend/scripts/check-architecture.js') continue;
      if (key === 'directHostMutation' && /^(?:backend\/(?:runtime|runner|planning|modules)\/)/.test(rel)) continue;
      if ((pattern && pattern.test(source)) || (key === 'backupFiles' && /qemuManager\.js\.backup$/.test(rel))) report[key].push(rel);
    }
  }
  for (const key of Object.keys(report)) report[key] = [...new Set(report[key])].sort();
  if (mode === 'enforce' && Object.values(report).some((items) => items.length)) { const error = new Error(JSON.stringify(report, null, 2)); error.report = report; throw error; }
  return report;
}
if (require.main === module) { const mode = process.argv[2] || 'inventory'; try { console.log(JSON.stringify(checkArchitecture({ root: path.resolve(__dirname, '../..'), mode }), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { checkArchitecture };
