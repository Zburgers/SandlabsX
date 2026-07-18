'use strict';
const { Runner } = require('./runner');
function startRunner(options) { const runner = new Runner(options); const interval = setInterval(() => runner.runOnce().catch(error => options.onError?.(error)), options.pollMs || 1000); return { runner, stop: () => clearInterval(interval) }; }
module.exports = { startRunner };
