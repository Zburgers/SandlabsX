import { describe, expect, it } from 'vitest';
import { readApiJson } from '../auth';

describe('readApiJson', () => {
  it('rejects HTML proxy and route failures with a useful message', async () => {
    const response = new Response('<!DOCTYPE html>', { status: 404, headers: { 'content-type': 'text/html' } });
    await expect(readApiJson(response)).rejects.toThrow('Authentication service returned an invalid response');
  });

  it('returns JSON API responses', async () => {
    const response = new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: { 'content-type': 'application/json' } });
    await expect(readApiJson(response)).resolves.toEqual({ success: false, error: 'Invalid credentials' });
  });
});
