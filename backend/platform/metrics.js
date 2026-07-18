'use strict';

function createMetrics() {
  const counters = new Map();
  return Object.freeze({
    increment(name, value = 1) { counters.set(name, (counters.get(name) || 0) + value); },
    snapshot() { return Object.fromEntries([...counters].map(([name, value]) => [name, value])); },
  });
}
module.exports = { createMetrics };
