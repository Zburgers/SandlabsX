'use strict';
// Temporary compatibility facade. Task 18 removes this module after callers use backend/planning directly.
const { hostToken, macFor, planNetwork } = require('../planning/networkPlanner');
function allocateNetwork(capsule, instanceId) { const network = planNetwork(capsule, instanceId); return { ...network, ports: {} }; }
function allocatePorts() { return {}; }
function token(prefix, value, length = 10) { return hostToken(prefix, value, length); }
module.exports = { allocateNetwork, allocatePorts, macFor, token };
