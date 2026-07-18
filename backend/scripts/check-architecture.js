'use strict';
const fs = require('node:fs');
const path = require('node:path');
function files(root) { const out = []; for (const entry of fs.readdirSync(root, { withFileTypes: true })) { if (['node_modules', '.git', '.next'].includes(entry.name)) continue; const full = path.join(root, entry.name); if (entry.isDirectory()) out.push(...files(full)); else if (/\.(js|cjs|ts|tsx|md)$/.test(entry.name) || entry.name === 'qemuManager.js.backup') out.push(full); } return out; }
function checkArchitecture({ root, mode = 'inventory' }) {
  const categories = { legacyImports: /(?:LabManager|nodeManagerPostgres)/, legacyRoutes: /\/api\/(?:labs|nodes)\b/, legacyTopology: /nodes\[\]\s*\+\s*edges\[\]|topologyJson|\.topology_json/, fixedNetwork: /\b(?:PC1|PC2|tap[0-9]+)\b/, shellExecution: /\b(?:exec|execAsync)\s*\(|shell\s*:\s*true/, backupFiles: null, directConsole: /\bconsole\.(?:log|warn|error|debug)\s*\(/, directHostMutation: /(?:ip\s+link|brctl|qemu-system|spawn\s*\()/ };
  const report = Object.fromEntries(Object.keys(categories).map((key) => [key, []]));
  for (const file of files(root)) {
    const source = fs.readFileSync(file, 'utf8'); const rel = path.relative(root, file);
    for (const [key, pattern] of Object.entries(categories)) if ((pattern && pattern.test(source)) || (key === 'backupFiles' && /qemuManager\.js\.backup$/.test(rel))) report[key].push(rel);
  }
  for (const key of Object.keys(report)) report[key] = [...new Set(report[key])].sort();
  if (mode === 'enforce' && Object.values(report).some((items) => items.length)) { const error = new Error(JSON.stringify(report, null, 2)); error.report = report; throw error; }
  return report;
}
if (require.main === module) { const mode = process.argv[2] || 'inventory'; try { console.log(JSON.stringify(checkArchitecture({ root: path.resolve(__dirname, '../..'), mode }), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { checkArchitecture };
