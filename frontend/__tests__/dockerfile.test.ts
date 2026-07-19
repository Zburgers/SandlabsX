import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('frontend container', () => {
  it('binds Next.js to every container interface so its loopback healthcheck works', () => {
    const dockerfile = readFileSync(resolve(process.cwd(), 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('ENV HOSTNAME=0.0.0.0');
  });
});
