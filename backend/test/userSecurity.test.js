'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createBootstrapAdmin, validateBootstrapCredentials } = require('../modules/adminBootstrap');
const { buildTokenClaims, shouldRequirePasswordChange, canChangeOwnRole } = require('../modules/userSecurity');

test('bootstrap credentials are required when the database is empty', () => {
  assert.throws(
    () => validateBootstrapCredentials({}),
    /SANDBOXX_ADMIN_EMAIL and SANDBOXX_ADMIN_PASSWORD are required/,
  );
});

test('bootstrap creates an admin with a forced password change and no password logging', async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT COUNT')) return { rows: [{ count: '0' }] };
      return { rows: [{ id: 'admin-id', email: 'admin@example.test', role: 'admin', auth_version: 0 }] };
    },
  };
  const result = await createBootstrapAdmin(client, {
    email: 'admin@example.test',
    password: 'development-password',
    id: 'admin-id',
  });

  assert.equal(result.created, true);
  assert.equal(calls.at(-1).params[1], 'admin@example.test');
  assert.equal(calls.at(-1).params.includes('development-password'), false);
  assert.match(calls.at(-1).params[2], /^[a-f0-9]+:[a-f0-9]+$/);
  assert.match(calls.at(-1).sql, /must_change_password/);
});

test('JWT claims include the database auth version and forced-change state is enforced', () => {
  assert.deepEqual(buildTokenClaims({ id: 'u1', email: 'u@test', role: 'admin', auth_version: 3 }), {
    sub: 'u1', email: 'u@test', role: 'admin', authVersion: 3,
  });
  assert.equal(shouldRequirePasswordChange({ must_change_password: true }, '/api/users'), true);
  assert.equal(shouldRequirePasswordChange({ must_change_password: true }, '/api/auth/change-password'), false);
});

test('an administrator cannot change their own role', () => {
  assert.equal(canChangeOwnRole('admin-id', 'admin-id'), false);
  assert.equal(canChangeOwnRole('admin-id', 'other-id'), true);
});
