import { describe, expect, it } from 'vitest';
import { CapsuleApiError, normalizeCapsuleError } from '../capsule-api';
import { capsuleEventCursor } from '../event-stream';

describe('Capsule API boundary', () => {
  it('preserves safe server error details and correlation IDs', () => {
    const error = normalizeCapsuleError({ code: 'REVISION_CONFLICT', message: 'Draft changed', correlationId: 'corr-7' }, 409);

    expect(error).toBeInstanceOf(CapsuleApiError);
    expect(error.code).toBe('REVISION_CONFLICT');
    expect(error.correlationId).toBe('corr-7');
    expect(error.message).toBe('Draft changed');
  });

  it('resumes event streams after the newest durable event', () => {
    expect(capsuleEventCursor([{ id: 'event-1' }, { id: 'event-2' }])).toBe('event-2');
    expect(capsuleEventCursor([])).toBeUndefined();
  });
});
