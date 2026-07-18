'use strict';

function requestSerializer(req) {
  return {
    method: req.method,
    url: req.originalUrl || req.url,
    requestId: req.id,
  };
}

function responseSerializer(res) {
  return { statusCode: res.statusCode };
}

function requestLogObject(req, res, metadata = {}) {
  return {
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    responseTime: metadata.responseTime,
  };
}

function requestLogLevel(_req, res, err) {
  if (res.statusCode === 401) return 'silent';
  if (err || res.statusCode >= 500) return 'error';
  return 'info';
}

module.exports = { requestSerializer, responseSerializer, requestLogObject, requestLogLevel };
