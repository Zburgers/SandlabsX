'use strict';
const crypto = require('node:crypto');
function requestContext({ observability } = {}) { return (req, res, next) => { const supplied = req.get('x-request-id'); const requestId = supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : crypto.randomUUID(); res.set('X-Request-Id', requestId); req.requestId = requestId; req.log = observability?.child({ requestId }) || req.log; next(); }; }
module.exports = { requestContext };
