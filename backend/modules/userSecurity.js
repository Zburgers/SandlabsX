'use strict';

function buildTokenClaims(user) {
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    authVersion: Number(user.auth_version ?? user.authVersion ?? 0),
  };
}

function shouldRequirePasswordChange(user, path) {
  return Boolean(user.must_change_password)
    && path !== '/api/auth/change-password'
    && path !== '/api/users/me';
}

function canChangeOwnRole(actorId, targetId) {
  return actorId !== targetId;
}

module.exports = { buildTokenClaims, shouldRequirePasswordChange, canChangeOwnRole };
